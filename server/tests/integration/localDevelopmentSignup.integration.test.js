process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS = 'true';

import { afterAll, describe, expect, it } from 'vitest';
import { requestApp } from '../helpers/http.js';
import { closeDbPool, deleteByIds } from '../helpers/db.js';

const createdUsers = [];

afterAll(async () => {
  await deleteByIds('users', 'id', createdUsers);
  await closeDbPool();
});

describe('local development auth signup', () => {
  it('creates a local user and returns trusted-local metadata for mobile smoke tests', async () => {
    const response = await requestApp()
      .post('/api/v1/auth/dev/local-signup')
      .send({
        phoneNumber: '+84901234567',
        displayName: 'Local Mobile User',
      })
      .expect(201);

    createdUsers.push(response.body.user.id);

    expect(response.body.user).toMatchObject({
      phoneNumber: '+84901234567',
      displayName: 'Local Mobile User',
      status: 'ACTIVE',
    });
    expect(response.body.trustedLocal).toMatchObject({
      userId: response.body.user.id,
      subject: `local:${response.body.user.id}`,
      phoneNumber: '+84901234567',
    });

    const profile = await requestApp()
      .get('/api/v1/users/me')
      .set('x-trustbite-user-id', response.body.trustedLocal.userId)
      .set('x-trustbite-subject', response.body.trustedLocal.subject)
      .set('x-trustbite-phone-number', response.body.trustedLocal.phoneNumber)
      .expect(200);

    expect(profile.body).toMatchObject({
      id: response.body.user.id,
      phoneNumber: '+84901234567',
      displayName: 'Local Mobile User',
    });
  });

  it('rejects invalid local signup phone numbers', async () => {
    const response = await requestApp()
      .post('/api/v1/auth/dev/local-signup')
      .send({ phoneNumber: 'not-phone' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
