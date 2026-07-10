import '../helpers/env.js';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';

const { createUser } = await import('../helpers/factories/index.js');
const { closeDbPool, query } = await import('../helpers/db.js');
const { requestApp } = await import('../helpers/http.js');

const authHeaders = (userId) => ({
  'x-trustbite-user-id': userId,
});

const createdUserIds = new Set();

async function newUser(overrides = {}) {
  const user = await createUser(overrides);
  createdUserIds.add(user.id);
  return user;
}

async function activeBlockCount(blockerId, blockedId) {
  const result = await query(
    'SELECT deleted_at FROM user_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2',
    [blockerId, blockedId],
  );
  return result.rows;
}

describe('user block API', () => {
  afterEach(async () => {
    for (const id of createdUserIds) {
      await query('DELETE FROM user_blocks WHERE blocker_user_id = $1 OR blocked_user_id = $1', [id]);
    }
    for (const id of createdUserIds) {
      await query('DELETE FROM users WHERE id = $1', [id]);
    }
    createdUserIds.clear();
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it('blocks a user and persists a single active row', async () => {
    const blocker = await newUser({ displayName: 'Blocker' });
    const target = await newUser({ displayName: 'Target' });

    const response = await requestApp()
      .post(`/api/v1/users/${target.id}/block`)
      .set(authHeaders(blocker.id))
      .send({ reasonCode: 'ABUSIVE_LANGUAGE' })
      .expect(201);

    expect(response.body).toMatchObject({ blockedUserId: target.id });
    expect(response.body.blockedAt).toBeTruthy();

    const rows = await activeBlockCount(blocker.id, target.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].deleted_at).toBeNull();
  });

  it('rejects self-block and writes no row', async () => {
    const user = await newUser({ displayName: 'Self Blocker' });

    const response = await requestApp()
      .post(`/api/v1/users/${user.id}/block`)
      .set(authHeaders(user.id))
      .send({})
      .expect(400);

    expect(response.body.error.code).toBe('CANNOT_BLOCK_SELF');
    const rows = await activeBlockCount(user.id, user.id);
    expect(rows).toHaveLength(0);
  });

  it('rejects a duplicate active block with 409', async () => {
    const blocker = await newUser({ displayName: 'Dup Blocker' });
    const target = await newUser({ displayName: 'Dup Target' });

    await requestApp()
      .post(`/api/v1/users/${target.id}/block`)
      .set(authHeaders(blocker.id))
      .send({})
      .expect(201);

    const response = await requestApp()
      .post(`/api/v1/users/${target.id}/block`)
      .set(authHeaders(blocker.id))
      .send({})
      .expect(409);

    expect(response.body.error.code).toBe('USER_ALREADY_BLOCKED');
    const rows = await activeBlockCount(blocker.id, target.id);
    expect(rows).toHaveLength(1);
  });

  it('unblocks by soft-deleting and re-blocks by reactivating the same row', async () => {
    const blocker = await newUser({ displayName: 'Cycle Blocker' });
    const target = await newUser({ displayName: 'Cycle Target' });

    await requestApp()
      .post(`/api/v1/users/${target.id}/block`)
      .set(authHeaders(blocker.id))
      .send({})
      .expect(201);

    const unblock = await requestApp()
      .delete(`/api/v1/users/${target.id}/block`)
      .set(authHeaders(blocker.id))
      .expect(200);
    expect(unblock.body).toEqual({ success: true });

    let rows = await activeBlockCount(blocker.id, target.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].deleted_at).not.toBeNull();

    await requestApp()
      .post(`/api/v1/users/${target.id}/block`)
      .set(authHeaders(blocker.id))
      .send({})
      .expect(201);

    rows = await activeBlockCount(blocker.id, target.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].deleted_at).toBeNull();
  });

  it('returns 404 when unblocking without an active block', async () => {
    const blocker = await newUser({ displayName: 'No Block' });
    const target = await newUser({ displayName: 'No Block Target' });

    const response = await requestApp()
      .delete(`/api/v1/users/${target.id}/block`)
      .set(authHeaders(blocker.id))
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when blocking a non-existent target user', async () => {
    const blocker = await newUser({ displayName: 'Ghost Blocker' });
    const missingId = '99999999-9999-4999-8999-999999999999';

    const response = await requestApp()
      .post(`/api/v1/users/${missingId}/block`)
      .set(authHeaders(blocker.id))
      .send({})
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects a non-UUID target at the HTTP boundary with 422', async () => {
    const blocker = await newUser({ displayName: 'Boundary Blocker' });

    const response = await requestApp()
      .post('/api/v1/users/not-a-uuid/block')
      .set(authHeaders(blocker.id))
      .send({})
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a suspended actor with 403 before any block write', async () => {
    const blocker = await newUser({ displayName: 'Suspended Blocker', status: 'SUSPENDED' });
    const target = await newUser({ displayName: 'Suspended Target' });

    const response = await requestApp()
      .post(`/api/v1/users/${target.id}/block`)
      .set(authHeaders(blocker.id))
      .send({})
      .expect(403);

    expect(response.body.error.code).toBe('ACCOUNT_SUSPENDED');
    const rows = await activeBlockCount(blocker.id, target.id);
    expect(rows).toHaveLength(0);
  });
});
