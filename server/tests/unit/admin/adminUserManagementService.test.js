import '../../helpers/env.js';
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/db.js', () => ({
  pool: {
    connect: vi.fn(),
    query: vi.fn(),
  },
}));

const { pool } = await import('../../../src/config/db.js');
const { AdminUserManagementService } = await import(
  '../../../src/services/adminUserManagementService.js'
);

const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  roles: ['ADMIN'],
};

const input = {
  email: 'new.user@example.com',
  displayName: 'New User',
  phoneNumber: '0912345678',
  dateOfBirth: '1990-01-01',
};

describe('AdminUserManagementService provisioning compensation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unknown create and update fields before persistence', async () => {
    const identityProvider = {
      createUser: vi.fn(),
      deleteUser: vi.fn(),
    };
    const service = new AdminUserManagementService({ identityProvider });

    await expect(service.createUser(actor, {
      ...input,
      unexpected: true,
    })).rejects.toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
    });
    await expect(service.updateUser(actor, crypto.randomUUID(), {
      displayName: 'Updated User',
      unexpected: true,
    })).rejects.toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
    });
    await expect(service.updateUser(actor, crypto.randomUUID(), null)).rejects.toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
    });
    expect(identityProvider.createUser).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('deletes the Cognito identity when a database connection cannot be opened', async () => {
    pool.connect.mockRejectedValue(new Error('database unavailable'));
    const identityProvider = {
      createUser: vi.fn().mockResolvedValue({
        username: input.email,
        subject: 'new-user-sub',
      }),
      deleteUser: vi.fn().mockResolvedValue({ deleted: true }),
    };
    const service = new AdminUserManagementService({ identityProvider });

    await expect(service.createUser(actor, input)).rejects.toThrow('database unavailable');
    expect(identityProvider.deleteUser).toHaveBeenCalledWith({
      username: input.email,
    });
  });

  it('still deletes the Cognito identity when transaction rollback fails', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(Object.assign(new Error('duplicate phone'), {
          code: '23505',
          constraint: 'users_phone_number_key',
        }))
        .mockRejectedValueOnce(new Error('rollback unavailable')),
      release: vi.fn(),
    };
    pool.connect.mockResolvedValue(client);
    const identityProvider = {
      createUser: vi.fn().mockResolvedValue({
        username: input.email,
        subject: 'new-user-sub',
      }),
      deleteUser: vi.fn().mockResolvedValue({ deleted: true }),
    };
    const service = new AdminUserManagementService({ identityProvider });

    await expect(service.createUser(actor, input)).rejects.toMatchObject({
      statusCode: 409,
      code: 'PHONE_NUMBER_IN_USE',
    });
    expect(identityProvider.deleteUser).toHaveBeenCalledWith({
      username: input.email,
    });
    expect(client.release).toHaveBeenCalled();
  });

  it('preserves the Cognito identity when a committed user is found after a commit error', async () => {
    const insertedUser = {
      id: '22222222-2222-4222-8222-222222222222',
      cognito_sub: 'new-user-sub',
      display_name: input.displayName,
      phone_number: '+84912345678',
      date_of_birth: input.dateOfBirth,
      status: 'ACTIVE',
      roles: ['USER'],
    };
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [insertedUser] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('commit response lost'))
        .mockResolvedValueOnce(undefined),
      release: vi.fn(),
    };
    pool.connect.mockResolvedValue(client);
    pool.query.mockResolvedValue({ rowCount: 1, rows: [insertedUser] });
    const identityProvider = {
      createUser: vi.fn().mockResolvedValue({
        username: input.email,
        subject: 'new-user-sub',
      }),
      deleteUser: vi.fn(),
    };
    const service = new AdminUserManagementService({ identityProvider });

    await expect(service.createUser(actor, input)).resolves.toMatchObject({
      id: insertedUser.id,
      roles: ['USER'],
    });
    expect(identityProvider.deleteUser).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });

  it('does not delete the Cognito identity when commit outcome verification fails', async () => {
    const insertedUser = {
      id: '22222222-2222-4222-8222-222222222222',
    };
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [insertedUser] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('commit response lost'))
        .mockResolvedValueOnce(undefined),
      release: vi.fn(),
    };
    pool.connect.mockResolvedValue(client);
    pool.query.mockRejectedValue(new Error('verification unavailable'));
    const identityProvider = {
      createUser: vi.fn().mockResolvedValue({
        username: input.email,
        subject: 'new-user-sub',
      }),
      deleteUser: vi.fn(),
    };
    const service = new AdminUserManagementService({ identityProvider });

    await expect(service.createUser(actor, input)).rejects.toMatchObject({
      statusCode: 503,
      code: 'USER_PROVISIONING_OUTCOME_UNKNOWN',
    });
    expect(identityProvider.deleteUser).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });
});
