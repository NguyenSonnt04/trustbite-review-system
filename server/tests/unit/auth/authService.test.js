import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

const mockAppConfig = vi.hoisted(() => ({
  default: {
    env: 'test',
    trustedAuthHeaders: false,
    auth: {
      provider: 'cognito',
      phoneFallbackEnabled: false,
      cognito: {
        clientId: 'local-test-client',
        issuer: 'https://cognito-idp.us-east-1.amazonaws.com/local-test-pool',
        jwksUri: 'https://cognito-idp.us-east-1.amazonaws.com/local-test-pool/.well-known/jwks.json',
      },
    },
  },
}));

function setPhoneFallbackEnabled(phoneFallbackEnabled) {
  mockAppConfig.default.auth = {
    ...mockAppConfig.default.auth,
    phoneFallbackEnabled,
  };
}

vi.mock('../../../src/config/db.js', () => ({
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

vi.mock('../../../src/config/app.js', () => mockAppConfig);

const { pool } = await import('../../../src/config/db.js');
const { AuthService } = await import('../../../src/services/auth.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';

function activeUserRow(overrides = {}) {
  return {
    id: USER_ID,
    phone_number: '+849000000001',
    display_name: 'Test User',
    avatar_url: null,
    status: 'ACTIVE',
    exp_points: 0,
    rank_code: 'NEWBIE',
    deletion_requested_at: null,
    deleted_at: null,
    created_at: new Date('2026-06-01T00:00:00.000Z'),
    updated_at: new Date('2026-06-01T00:00:00.000Z'),
    cognito_sub: 'cognito-sub-1',
    ...overrides,
  };
}

describe('AuthService local user mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockClient.release.mockReset();
    pool.connect.mockResolvedValue(mockClient);
    setPhoneFallbackEnabled(false);
  });

  it('maps a Cognito subject to the matching local user', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow()] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ role_id: 'USER' }] });

    const service = new AuthService({ verifyAccessToken: vi.fn() });

    await expect(service.mapIdentityToUser({
      provider: 'cognito',
      subject: 'cognito-sub-1',
      phoneNumber: '+849000000001',
      phoneNumberVerified: true,
      tokenUse: 'access',
    })).resolves.toMatchObject({
      id: USER_ID,
      phoneNumber: '+849000000001',
      displayName: 'Test User',
      cognitoSub: 'cognito-sub-1',
      roles: ['USER'],
      cognito: {
        sub: 'cognito-sub-1',
        tokenUse: 'access',
        phoneNumber: '+849000000001',
        phoneNumberVerified: true,
      },
    });
  });

  it('provisions a local user for a verified Cognito identity without a phone number', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [activeUserRow({
          phone_number: null,
          cognito_sub: 'new-cognito-sub',
        })],
      })
      .mockResolvedValueOnce({});

    const service = new AuthService({ verifyAccessToken: vi.fn() });

    await expect(service.mapIdentityToUser({
      provider: 'cognito',
      subject: 'new-cognito-sub',
      phoneNumber: null,
      phoneNumberVerified: false,
      tokenUse: 'access',
    })).resolves.toMatchObject({
      id: USER_ID,
      phoneNumber: null,
      cognitoSub: 'new-cognito-sub',
      roles: [],
    });

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users (phone_number, cognito_sub)'),
      ['new-cognito-sub'],
    );
    expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('rolls back local Cognito user provisioning when the insert fails', async () => {
    const insertError = new Error('database unavailable');
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    mockClient.query
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(insertError)
      .mockResolvedValueOnce({});

    const service = new AuthService({ verifyAccessToken: vi.fn() });

    await expect(service.mapIdentityToUser({
      provider: 'cognito',
      subject: 'new-cognito-sub',
      phoneNumber: null,
      phoneNumberVerified: false,
      tokenUse: 'access',
    })).rejects.toBe(insertError);

    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO users (phone_number, cognito_sub)'),
      ['new-cognito-sub'],
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('includes active deletion request state in the mapped local user', async () => {
    pool.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [activeUserRow({
          active_deletion_request_id: '22222222-2222-4222-8222-222222222222',
          active_deletion_request_status: 'PROCESSING',
        })],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ role_id: 'USER' }] });

    const service = new AuthService({ verifyAccessToken: vi.fn() });

    await expect(service.mapIdentityToUser({
      provider: 'cognito',
      subject: 'cognito-sub-1',
      phoneNumber: '+849000000001',
      phoneNumberVerified: true,
      tokenUse: 'access',
    }, { enforceStatus: false })).resolves.toMatchObject({
      id: USER_ID,
      activeDeletionRequest: {
        id: '22222222-2222-4222-8222-222222222222',
        status: 'PROCESSING',
      },
    });
  });

  it('verifies a bearer token through the identity provider before local mapping', async () => {
    const identityProvider = {
      verifyAccessToken: vi.fn().mockResolvedValue({
        provider: 'cognito',
        subject: 'cognito-sub-1',
        phoneNumber: '+849000000001',
        phoneNumberVerified: true,
        tokenUse: 'access',
      }),
    };
    const req = {
      header: vi.fn((name) => (name.toLowerCase() === 'authorization' ? 'Bearer test-access-token' : undefined)),
    };

    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow()] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const service = new AuthService(identityProvider);

    await expect(service.authenticateRequest(req)).resolves.toMatchObject({
      id: USER_ID,
      cognitoSub: 'cognito-sub-1',
      identity: {
        provider: 'cognito',
        subject: 'cognito-sub-1',
        tokenUse: 'access',
      },
    });

    expect(identityProvider.verifyAccessToken).toHaveBeenCalledWith('test-access-token');
  });

  it('provisions a Cognito user instead of requiring phone fallback', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [activeUserRow({
          phone_number: null,
          cognito_sub: 'new-cognito-sub',
        })],
      })
      .mockResolvedValueOnce({});

    const service = new AuthService({ verifyAccessToken: vi.fn() });

    await expect(service.mapIdentityToUser({
      provider: 'cognito',
      subject: 'new-cognito-sub',
      phoneNumber: '+849000000001',
      phoneNumberVerified: true,
      tokenUse: 'access',
    })).resolves.toMatchObject({
      id: USER_ID,
      phoneNumber: null,
      cognitoSub: 'new-cognito-sub',
    });

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('binds a verified phone transition user only when fallback is enabled', async () => {
    setPhoneFallbackEnabled(true);

    pool.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ role_id: 'USER' }] });

    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [activeUserRow({ cognito_sub: null })],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [activeUserRow({ cognito_sub: 'new-cognito-sub' })],
      })
      .mockResolvedValueOnce({});

    const service = new AuthService({ verifyAccessToken: vi.fn() });

    await expect(service.mapIdentityToUser({
      provider: 'cognito',
      subject: 'new-cognito-sub',
      phoneNumber: '+849000000001',
      phoneNumberVerified: true,
      tokenUse: 'access',
    })).resolves.toMatchObject({
      id: USER_ID,
      phoneNumber: '+849000000001',
      cognitoSub: 'new-cognito-sub',
      roles: ['USER'],
    });

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE u.phone_number = $1'),
      ['+849000000001'],
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE OF u'),
      ['+849000000001'],
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('active_deletion_request_id'),
      ['new-cognito-sub', USER_ID],
    );
    expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('rejects unmapped identities from unsupported providers', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const service = new AuthService({ verifyAccessToken: vi.fn() });

    await expect(service.mapIdentityToUser({
      provider: 'unsupported',
      subject: 'new-cognito-sub',
      phoneNumber: '+849000000001',
      phoneNumberVerified: false,
      tokenUse: 'access',
    })).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNMAPPED_IDENTITY',
    });

    expect(pool.connect).not.toHaveBeenCalled();
  });
});
