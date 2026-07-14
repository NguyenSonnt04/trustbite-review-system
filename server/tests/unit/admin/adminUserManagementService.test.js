import '../../helpers/env.js';
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
});
