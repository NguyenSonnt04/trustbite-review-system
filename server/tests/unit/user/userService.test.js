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
    avatarAllowedHosts: ['cdn.trustbite.test'],
  },
}));

const { pool } = await import('../../../src/config/db.js');
const { UserService } = await import('../../../src/services/userService.js');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const DELETION_REQUEST_ID = '22222222-2222-4222-8222-222222222222';

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
    ...overrides,
    };
  }

function deletionRequestRow(overrides = {}) {
  return {
    id: DELETION_REQUEST_ID,
    user_id: USER_ID,
    status: 'REQUESTED',
    reason: null,
    requested_at: new Date('2026-06-01T00:00:00.000Z'),
    scheduled_deletion_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: new Date('2026-06-01T00:00:00.000Z'),
    updated_at: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('UserService account deletion guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockClient.release.mockReset();
    pool.connect.mockResolvedValue(mockClient);
  });

  it.each(['REQUESTED', 'PROCESSING'])(
    'rejects profile mutations while a deletion request is %s',
    async (status) => {
      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow()] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: '22222222-2222-4222-8222-222222222222', status }],
        })
        .mockResolvedValueOnce({});

      const service = new UserService();

      await expect(service.updateCurrentUser(USER_ID, { displayName: 'New Name' }))
        .rejects
        .toMatchObject({ statusCode: 409, code: 'DELETION_REQUEST_ACTIVE' });

      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET display_name'),
        expect.any(Array),
      );
      expect(mockClient.query).toHaveBeenLastCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects duplicate open deletion requests', async () => {
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow()] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [deletionRequestRow({ status: 'PROCESSING' })] })
      .mockResolvedValueOnce({});

    const service = new UserService();

    await expect(service.createDeletionRequest(USER_ID, { confirmationText: 'XÓA TÀI KHOẢN' }))
      .rejects
      .toMatchObject({ statusCode: 409, code: 'DELETION_REQUEST_ALREADY_EXISTS' });

    expect(mockClient.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO account_deletion_requests'),
      expect.any(Array),
    );
    expect(mockClient.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('writes an audit record when creating a deletion request without copying the deletion reason', async () => {
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow()] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [deletionRequestRow()] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow({ deletion_requested_at: new Date('2026-06-01T00:00:00.000Z') })] })
      .mockResolvedValueOnce({ rowCount: 2, rows: [{ id: 'session-1' }, { id: 'session-2' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'push-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'audit-1' }] })
      .mockResolvedValueOnce({});

    const service = new UserService();

    await expect(service.createDeletionRequest(USER_ID, {
      confirmationText: 'XÓA TÀI KHOẢN',
      reason: 'Sensitive deletion reason',
    }))
      .resolves
      .toMatchObject({
        deletionRequestId: DELETION_REQUEST_ID,
        status: 'REQUESTED',
      });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      [
        USER_ID,
        'USER',
        'ACCOUNT_DELETION_REQUESTED',
        'ACCOUNT_DELETION_REQUEST',
        DELETION_REQUEST_ID,
        null,
        'REQUESTED',
        {
          revokedSessions: 2,
          inactivatedPushTokens: 1,
        },
      ],
    );
    const auditCall = mockClient.query.mock.calls.find(([sql]) => (
      typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')
    ));
    expect(auditCall[0]).not.toContain('reason');
    expect(auditCall[1]).not.toContain('Sensitive deletion reason');
    expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('writes an audit record when cancelling a deletion request', async () => {
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [deletionRequestRow()] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [deletionRequestRow({ status: 'CANCELLED', cancelled_at: new Date('2026-06-01T00:10:00.000Z') })] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow()] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'audit-2' }] })
      .mockResolvedValueOnce({});

    const service = new UserService();

    await expect(service.cancelDeletionRequest(USER_ID))
      .resolves
      .toMatchObject({
        deletionRequestId: DELETION_REQUEST_ID,
        status: 'CANCELLED',
      });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      [
        USER_ID,
        'USER',
        'ACCOUNT_DELETION_CANCELLED',
        'ACCOUNT_DELETION_REQUEST',
        DELETION_REQUEST_ID,
        'REQUESTED',
        'CANCELLED',
        {},
      ],
    );
    expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
  });
  });
