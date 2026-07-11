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
    date_of_birth: '1990-01-01',
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

  it('maps date-only Date values from their UTC calendar components', async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        activeUserRow({
          date_of_birth: new Date('2004-11-20T20:00:00.000Z'),
        }),
      ],
    });

    const service = new UserService();
    const result = await service.getCurrentUser(USER_ID);

    expect(result.dateOfBirth).toBe('2004-11-20');
  });

  it('normalizes and persists profile onboarding fields transactionally', async () => {
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow()] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [activeUserRow({
          phone_number: '+84395665937',
          display_name: 'Nguyen Son',
          date_of_birth: '2004-11-20',
        })],
      })
      .mockResolvedValueOnce({});

    const service = new UserService();
    const result = await service.updateCurrentUser(USER_ID, {
      displayName: '  Nguyen Son  ',
      phoneNumber: '0395 665 937',
      dateOfBirth: '2004-11-20',
    });

    expect(result).toMatchObject({
      displayName: 'Nguyen Son',
      phoneNumber: '+84395665937',
      dateOfBirth: '2004-11-20',
      profileComplete: true,
    });
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('phone_number = $2'),
      ['Nguyen Son', '+84395665937', '2004-11-20', USER_ID],
    );
    expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it.each([
    [{ phoneNumber: 'not-a-phone' }, 'phoneNumber'],
    [{ dateOfBirth: '2025-02-29' }, 'dateOfBirth'],
    [{ dateOfBirth: '2999-01-01' }, 'dateOfBirth'],
  ])('rejects malformed onboarding input %j before a transaction', async (body, field) => {
    const service = new UserService();

    await expect(service.updateCurrentUser(USER_ID, body))
      .rejects
      .toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });

    expect(pool.connect).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).toContain(field);
  });

  it('returns a conflict and rolls back when the phone number is already used', async () => {
    const duplicateError = Object.assign(new Error('duplicate phone'), {
      code: '23505',
      constraint: 'users_phone_number_key',
    });
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow()] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockRejectedValueOnce(duplicateError)
      .mockResolvedValueOnce({});

    const service = new UserService();

    await expect(service.updateCurrentUser(USER_ID, { phoneNumber: '0395665937' }))
      .rejects
      .toMatchObject({ statusCode: 409, code: 'PHONE_NUMBER_IN_USE' });

    expect(mockClient.query).toHaveBeenLastCalledWith('ROLLBACK');
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

  it('rejects deletion reasons longer than 500 characters before opening a transaction', async () => {
    const service = new UserService();

    await expect(service.createDeletionRequest(USER_ID, {
      confirmationText: 'XÓA TÀI KHOẢN',
      reason: 'x'.repeat(501),
    }))
      .rejects
      .toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });

    expect(pool.connect).not.toHaveBeenCalled();
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
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow()] })
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

  it('rejects deletion request cancellation for suspended users', async () => {
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow({ status: 'SUSPENDED' })] })
      .mockResolvedValueOnce({});

    const service = new UserService();

    await expect(service.cancelDeletionRequest(USER_ID))
      .rejects
      .toMatchObject({ statusCode: 403, code: 'ACCOUNT_SUSPENDED' });

    expect(mockClient.query).not.toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM account_deletion_requests'),
      expect.any(Array),
    );
    expect(mockClient.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
  });

const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const TARGET_ID = '44444444-4444-4444-8444-444444444444';
const AUDIT_ID = '55555555-5555-4555-8555-555555555555';
const adminActor = (overrides = {}) => ({
  id: ADMIN_ID,
  roles: ['ADMIN'],
  ...overrides,
});

describe('UserService admin suspension transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockClient.release.mockReset();
    pool.connect.mockResolvedValue(mockClient);
  });

  it('suspends an active user, revokes sessions, and writes admin audit metadata', async () => {
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow({ id: TARGET_ID })] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow({ id: TARGET_ID, status: 'SUSPENDED' })] })
      .mockResolvedValueOnce({ rowCount: 2, rows: [{ id: 'session-1' }, { id: 'session-2' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'push-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: AUDIT_ID }] })
      .mockResolvedValueOnce({});

    const service = new UserService();

    await expect(service.suspendUser(adminActor(), TARGET_ID, 'Safety investigation reason'))
      .resolves
      .toMatchObject({
        userId: TARGET_ID,
        status: 'SUSPENDED',
        revokedSessions: 2,
        auditLogId: AUDIT_ID,
      });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE users SET status = 'SUSPENDED'"),
      [TARGET_ID],
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      [ADMIN_ID, 'ADMIN', TARGET_ID, 'ACTIVE', 'Safety investigation reason', { revokedSessions: 2 }],
    );
    expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('reactivates a suspended user and writes admin audit evidence without session restoration', async () => {
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow({ id: TARGET_ID, status: 'SUSPENDED' })] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow({ id: TARGET_ID, status: 'ACTIVE' })] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: AUDIT_ID }] })
      .mockResolvedValueOnce({});

    const service = new UserService();

    await expect(service.reactivateUser(adminActor(), TARGET_ID, 'Appeal accepted reason'))
      .resolves
      .toMatchObject({
        userId: TARGET_ID,
        status: 'ACTIVE',
        auditLogId: AUDIT_ID,
      });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE users SET status = 'ACTIVE'"),
      [TARGET_ID],
    );
    expect(mockClient.query.mock.calls.some(([sql]) => (
      typeof sql === 'string' && sql.includes('UPDATE user_sessions')
    ))).toBe(false);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      [ADMIN_ID, 'ADMIN', TARGET_ID, 'SUSPENDED', 'Appeal accepted reason'],
    );
    expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('rejects non-admin actors before opening a transaction', async () => {
    const service = new UserService();

    await expect(service.suspendUser({ id: USER_ID, roles: ['USER'] }, TARGET_ID, 'Safety reason'))
      .rejects
      .toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

    expect(pool.connect).not.toHaveBeenCalled();
  });

  it.each([
    ['suspendUser', 'CANNOT_SUSPEND_DELETED_USER', 'DELETED'],
    ['suspendUser', 'CANNOT_SUSPEND_SELF', 'ACTIVE', ADMIN_ID],
    ['suspendUser', 'USER_ALREADY_SUSPENDED', 'SUSPENDED'],
    ['suspendUser', 'ADMIN_REASON_REQUIRED', 'ACTIVE', TARGET_ID, 'short'],
    ['reactivateUser', 'CANNOT_REACTIVATE_DELETED_USER', 'DELETED'],
    ['reactivateUser', 'CANNOT_REACTIVATE_SELF', 'SUSPENDED', ADMIN_ID],
    ['reactivateUser', 'USER_NOT_SUSPENDED', 'ACTIVE'],
    ['reactivateUser', 'ADMIN_REASON_REQUIRED', 'SUSPENDED', TARGET_ID, 'short'],
  ])('enforces %s validation order with %s', async (methodName, expectedCode, targetStatus, targetId = TARGET_ID, reason = 'Valid admin reason') => {
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow({ id: targetId, status: targetStatus })] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({});

    const service = new UserService();

    await expect(service[methodName](adminActor(), targetId, reason))
      .rejects
      .toMatchObject({ code: expectedCode });

    expect(mockClient.query.mock.calls.some(([sql]) => (
      typeof sql === 'string' && sql.includes('UPDATE users SET status')
    ))).toBe(false);
    expect(mockClient.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('runs admin tier checks before target status-specific errors', async () => {
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeUserRow({ id: TARGET_ID, status: 'DELETED' })] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ role_id: 'SUPER_ADMIN' }] })
      .mockResolvedValueOnce({});

    const service = new UserService();

    await expect(service.suspendUser(adminActor(), TARGET_ID, 'Valid admin reason'))
      .rejects
      .toMatchObject({ statusCode: 403, code: 'INSUFFICIENT_ADMIN_TIER' });

    expect(mockClient.query).toHaveBeenLastCalledWith('ROLLBACK');
  });
});
