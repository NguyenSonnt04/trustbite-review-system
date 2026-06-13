import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

vi.mock('../../../src/config/db.js', () => ({
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

vi.mock('../../../src/config/app.js', () => ({
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

const { pool } = await import('../../../src/config/db.js');
const appConfig = (await import('../../../src/config/app.js')).default;
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
    appConfig.auth.phoneFallbackEnabled = false;
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

  it('rejects verified-phone transition mapping when fallback is not explicitly enabled', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const service = new AuthService({ verifyAccessToken: vi.fn() });

    await expect(service.mapIdentityToUser({
      provider: 'cognito',
      subject: 'new-cognito-sub',
      phoneNumber: '+849000000001',
      phoneNumberVerified: true,
      tokenUse: 'access',
    })).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNMAPPED_IDENTITY',
    });

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('binds a verified phone transition user only when fallback is enabled', async () => {
    appConfig.auth.phoneFallbackEnabled = true;

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
      expect.stringContaining('SELECT * FROM users WHERE phone_number = $1 AND cognito_sub IS NULL FOR UPDATE'),
      ['+849000000001'],
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      ['new-cognito-sub', USER_ID],
    );
    expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('rejects unmapped identities without a verified phone fallback claim', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const service = new AuthService({ verifyAccessToken: vi.fn() });

    await expect(service.mapIdentityToUser({
      provider: 'cognito',
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
