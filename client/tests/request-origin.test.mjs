import assert from 'node:assert/strict';
import test from 'node:test';

import { isAllowedRequestOrigin } from '../src/services/request-origin.mjs';

test('accepts the configured HTTPS public origin behind an HTTP ALB hop', () => {
  assert.equal(isAllowedRequestOrigin({
    originHeader: 'https://www.trustbite.io.vn',
    publicOrigin: 'https://www.trustbite.io.vn',
    requestUrl: 'http://10.42.2.128:3000/api/admin-auth/login',
    production: true,
  }), true);
});

test('rejects a different browser origin in production', () => {
  assert.equal(isAllowedRequestOrigin({
    originHeader: 'https://attacker.example',
    publicOrigin: 'https://www.trustbite.io.vn',
    requestUrl: 'http://10.42.2.128:3000/api/admin-auth/login',
    production: true,
  }), false);
});

test('fails closed when the production public origin is missing or malformed', () => {
  assert.equal(isAllowedRequestOrigin({
    originHeader: 'https://www.trustbite.io.vn',
    publicOrigin: '',
    requestUrl: 'https://www.trustbite.io.vn/api/admin-auth/login',
    production: true,
  }), false);
  assert.equal(isAllowedRequestOrigin({
    originHeader: 'https://www.trustbite.io.vn',
    publicOrigin: 'https://www.trustbite.io.vn/path',
    requestUrl: 'https://www.trustbite.io.vn/api/admin-auth/login',
    production: true,
  }), false);
});

test('uses the request URL origin as the local-development fallback', () => {
  assert.equal(isAllowedRequestOrigin({
    originHeader: 'http://localhost:3000',
    publicOrigin: '',
    requestUrl: 'http://localhost:3000/api/admin-auth/login',
    production: false,
  }), true);
});
