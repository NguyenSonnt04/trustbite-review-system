import '../helpers/env.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let AdminUserManagementService;
let closeDbPool;
let createUser;
let query;

const createdUserIds = [];
const createdRoleIds = new Set();

async function ensureRole(roleId) {
  const result = await query(
    `INSERT INTO roles (id, label, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [roleId, roleId, `${roleId} integration role`],
  );
  if (result.rowCount > 0) createdRoleIds.add(roleId);
}

async function assignRole(userId, roleId) {
  await ensureRole(roleId);
  await query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId, roleId],
  );
}

async function cleanup() {
  if (createdUserIds.length > 0) {
    await query(
      'DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[]) OR entity_id = ANY($1::uuid[])',
      [createdUserIds],
    );
    await query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [createdUserIds]);
    await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdUserIds]);
  }
  if (createdRoleIds.size > 0) {
    await query(
      `DELETE FROM roles r
       WHERE r.id = ANY($1::varchar[])
         AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.role_id = r.id)`,
      [[...createdRoleIds]],
    );
  }
}

describe('admin user management service', () => {
  beforeAll(async () => {
    ({ AdminUserManagementService } = await import('../../src/services/adminUserManagementService.js'));
    ({ closeDbPool, query } = await import('../helpers/db.js'));
    ({ createUser } = await import('../helpers/factories/index.js'));
    await Promise.all(['USER', 'ADMIN', 'SUPER_ADMIN'].map(ensureRole));
  });

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      await closeDbPool();
    }
  });

  it('lists users with deterministic pagination, roles, and masked phone data', async () => {
    const actor = await createUser({ displayName: 'List Super Admin' });
    const target = await createUser({
      displayName: 'Searchable Account',
      phoneNumber: '+84912345678',
    });
    createdUserIds.push(actor.id, target.id);
    await assignRole(actor.id, 'SUPER_ADMIN');
    await assignRole(target.id, 'USER');

    const service = new AdminUserManagementService();
    const result = await service.listUsers(
      { id: actor.id, roles: ['SUPER_ADMIN'] },
      { keyword: 'Searchable', page: '1', pageSize: '10' },
    );

    expect(result.items).toContainEqual(expect.objectContaining({
      id: target.id,
      displayName: 'Searchable Account',
      phoneNumberMasked: '+84******678',
      roles: ['USER'],
    }));
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBeGreaterThanOrEqual(1);

    const maskedSearch = await service.listUsers(
      { id: actor.id, roles: ['SUPER_ADMIN'] },
      { keyword: '+84******678', page: '1', pageSize: '10' },
    );
    expect(maskedSearch.items.map((user) => user.id)).toContain(target.id);

    const emptyPage = await service.listUsers(
      { id: actor.id, roles: ['SUPER_ADMIN'] },
      { keyword: 'Searchable', page: '999', pageSize: '10' },
    );
    expect(emptyPage.items).toEqual([]);
    expect(emptyPage.total).toBeGreaterThanOrEqual(1);
  });

  it('allows ADMIN actors to inspect SUPER_ADMIN details', async () => {
    const actor = await createUser({ displayName: 'Detail Admin' });
    const target = await createUser({ displayName: 'Detail Super Admin' });
    createdUserIds.push(actor.id, target.id);
    await assignRole(actor.id, 'ADMIN');
    await assignRole(target.id, 'SUPER_ADMIN');

    const service = new AdminUserManagementService();
    await expect(service.getUser(
      { id: actor.id, roles: ['ADMIN'] },
      target.id,
    )).resolves.toMatchObject({
      id: target.id,
      roles: expect.arrayContaining(['SUPER_ADMIN']),
    });
  });

  it('creates a confirmed Cognito identity, local profile, USER role, and audit evidence', async () => {
    const actor = await createUser({ displayName: 'Create Admin' });
    createdUserIds.push(actor.id);
    await assignRole(actor.id, 'ADMIN');

    const identityProvider = {
      createUser: vi.fn().mockResolvedValue({
        username: 'created.user@example.com',
        subject: 'created-user-cognito-sub',
      }),
      deleteUser: vi.fn(),
    };
    const service = new AdminUserManagementService({ identityProvider });

    const result = await service.createUser(
      { id: actor.id, roles: ['ADMIN'] },
      {
        email: 'created.user@example.com',
        displayName: 'Created User',
        dateOfBirth: '1995-05-20',
        phoneNumber: '0912345679',
      },
    );
    createdUserIds.push(result.id);

    expect(identityProvider.createUser).toHaveBeenCalledWith({
      email: 'created.user@example.com',
    });
    expect(result).toMatchObject({
      displayName: 'Created User',
      phoneNumber: '+84912345679',
      dateOfBirth: '1995-05-20',
      status: 'ACTIVE',
      roles: ['USER'],
    });

    const proof = await query(
      `SELECT u.cognito_sub, ur.role_id, a.action, a.actor_role
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN audit_logs a ON a.entity_id = u.id
       WHERE u.id = $1`,
      [result.id],
    );
    expect(proof.rows).toContainEqual(expect.objectContaining({
      cognito_sub: 'created-user-cognito-sub',
      role_id: 'USER',
      action: 'USER_CREATE',
      actor_role: 'ADMIN',
    }));
  });

  it('updates profile fields and lets only SUPER_ADMIN manage roles with audit evidence', async () => {
    const superAdmin = await createUser({ displayName: 'Role Super Admin' });
    const target = await createUser({ displayName: 'Role Target' });
    createdUserIds.push(superAdmin.id, target.id);
    await assignRole(superAdmin.id, 'SUPER_ADMIN');
    await assignRole(target.id, 'USER');

    const service = new AdminUserManagementService();
    const result = await service.updateUser(
      { id: superAdmin.id, roles: ['SUPER_ADMIN'] },
      target.id,
      {
        displayName: 'Updated Target',
        roles: ['USER', 'ADMIN'],
        reason: 'Promoted for operations coverage',
      },
    );

    expect(result).toMatchObject({
      id: target.id,
      displayName: 'Updated Target',
      roles: ['ADMIN', 'USER'],
    });

    const audits = await query(
      `SELECT action, actor_role, reason, metadata
       FROM audit_logs
       WHERE actor_id = $1 AND entity_id = $2
       ORDER BY created_at`,
      [superAdmin.id, target.id],
    );
    expect(audits.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'USER_PROFILE_UPDATE',
        actor_role: 'SUPER_ADMIN',
      }),
      expect.objectContaining({
        action: 'USER_ROLES_UPDATE',
        actor_role: 'SUPER_ADMIN',
        reason: 'Promoted for operations coverage',
      }),
    ]));
  });

  it('compensates the Cognito identity when local persistence fails', async () => {
    const actor = await createUser({ displayName: 'Compensation Admin' });
    const existing = await createUser({
      displayName: 'Existing Phone Owner',
      phoneNumber: '+84987654321',
    });
    createdUserIds.push(actor.id, existing.id);
    await assignRole(actor.id, 'ADMIN');

    const identityProvider = {
      createUser: vi.fn().mockResolvedValue({
        username: 'rollback.user@example.com',
        subject: 'rollback-user-cognito-sub',
      }),
      deleteUser: vi.fn().mockResolvedValue({ deleted: true }),
    };
    const service = new AdminUserManagementService({ identityProvider });

    await expect(service.createUser(
      { id: actor.id, roles: ['ADMIN'] },
      {
        email: 'rollback.user@example.com',
        displayName: 'Rollback User',
        dateOfBirth: '1992-02-20',
        phoneNumber: '+84987654321',
      },
    )).rejects.toMatchObject({
      statusCode: 409,
      code: 'PHONE_NUMBER_IN_USE',
    });

    expect(identityProvider.deleteUser).toHaveBeenCalledWith({
      username: 'rollback.user@example.com',
    });
    const residue = await query(
      'SELECT id FROM users WHERE cognito_sub = $1',
      ['rollback-user-cognito-sub'],
    );
    expect(residue.rowCount).toBe(0);
  });

  it('rejects role management by ADMIN actors', async () => {
    const admin = await createUser({ displayName: 'Tier Admin' });
    const target = await createUser({ displayName: 'Tier Target' });
    createdUserIds.push(admin.id, target.id);
    await assignRole(admin.id, 'ADMIN');
    await assignRole(target.id, 'USER');

    const service = new AdminUserManagementService();
    await expect(service.updateUser(
      { id: admin.id, roles: ['ADMIN'] },
      target.id,
      {
        roles: ['USER', 'ADMIN'],
        reason: 'Attempted unauthorized promotion',
      },
    )).rejects.toMatchObject({
      statusCode: 403,
      code: 'SUPER_ADMIN_REQUIRED',
    });
  });
});
