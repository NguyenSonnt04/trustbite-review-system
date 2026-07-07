import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAppConfig = vi.hoisted(() => ({
  default: {
    auth: {
      cognito: {
        clientId: 'local-test-client',
        issuer: 'https://cognito-idp.us-east-1.amazonaws.com/local-test-pool',
        jwksUri: 'https://cognito-idp.us-east-1.amazonaws.com/local-test-pool/.well-known/jwks.json',
      },
    },
  },
}));

vi.mock('../../../src/config/app.js', () => mockAppConfig);

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const keyId = 'test-key-id';
const publicJwk = {
  ...publicKey.export({ format: 'jwk' }),
  alg: 'RS256',
  kid: keyId,
  use: 'sig',
};

const encodeJson = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

function signAccessToken(payloadOverrides = {}, {
  algorithm = 'RS256',
  signingKey = privateKey,
  signingKeyId = keyId,
} = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = encodeJson({ alg: algorithm, kid: signingKeyId, typ: 'JWT' });
  const encodedPayload = encodeJson({
    sub: 'cognito-sub-1',
    iss: mockAppConfig.default.auth.cognito.issuer,
    client_id: mockAppConfig.default.auth.cognito.clientId,
    token_use: 'access',
    exp: now + 300,
    ...payloadOverrides,
  });
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`), signingKey)
    .toString('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const jwksResponse = (keys = [publicJwk]) => ({
  ok: true,
  json: vi.fn().mockResolvedValue({ keys }),
});

async function loadProvider() {
  const { CognitoIdentityProvider } = await import(
    '../../../src/services/identityProviders/cognitoProvider.js'
  );
  return new CognitoIdentityProvider();
}

describe('CognitoIdentityProvider', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jwksResponse()));
  });

  it('verifies a valid Cognito access token against provider JWKS', async () => {
    const provider = await loadProvider();

    await expect(provider.verifyAccessToken(signAccessToken({
      phone_number: '+849000000001',
      phone_number_verified: true,
      'cognito:groups': ['operators'],
    }))).resolves.toMatchObject({
      provider: 'cognito',
      subject: 'cognito-sub-1',
      phoneNumber: '+849000000001',
      phoneNumberVerified: true,
      tokenUse: 'access',
      roles: [],
      providerGroups: ['operators'],
    });

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('fails Cognito admin cleanup when the provider username is missing', async () => {
      const { CognitoIdentityProvider: ProviderClass } = await import(
        '../../../src/services/identityProviders/cognitoProvider.js'
      );
      const adminClient = {
        send: vi.fn(),
      };
      const provider = new ProviderClass({
        userPoolId: 'pool-1',
        adminClient,
      });

      await expect(provider.deleteUser({ username: null })).rejects.toMatchObject({
        name: 'CognitoUsernameRequiredError',
        code: 'COGNITO_USERNAME_REQUIRED',
      });
      expect(adminClient.send).not.toHaveBeenCalled();
    });

    it('rejects a token whose nbf claim is not a numeric date', async () => {
      const provider = await loadProvider();

    await expect(provider.verifyAccessToken(signAccessToken({
      nbf: 'not-a-numeric-date',
    }))).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_TOKEN',
    });
  });

  it.each([
    ['issuer', { iss: 'https://invalid.example.test/pool' }, 'INVALID_TOKEN'],
    ['client id', { client_id: 'wrong-client' }, 'INVALID_TOKEN'],
    ['token use', { token_use: 'id' }, 'INVALID_TOKEN'],
    ['subject', { sub: '' }, 'INVALID_TOKEN'],
    ['expiration', { exp: Math.floor(Date.now() / 1000) - 1 }, 'TOKEN_EXPIRED'],
    ['not-before time', { nbf: Math.floor(Date.now() / 1000) + 300 }, 'INVALID_TOKEN'],
  ])('rejects a token with invalid %s', async (_caseName, claims, errorCode) => {
    const provider = await loadProvider();

    await expect(provider.verifyAccessToken(signAccessToken(claims))).rejects.toMatchObject({
      statusCode: 401,
      code: errorCode,
    });
  });

  it('rejects unsupported JWT algorithms before accepting the token', async () => {
    const provider = await loadProvider();

    await expect(provider.verifyAccessToken(signAccessToken({}, {
      algorithm: 'RS512',
    }))).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_TOKEN',
    });
  });

  it('rejects a JWT signed by a key that does not match its kid', async () => {
    const alternateKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const provider = await loadProvider();

    await expect(provider.verifyAccessToken(signAccessToken({}, {
      signingKey: alternateKeys.privateKey,
    }))).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_TOKEN',
    });
  });

  it('fails closed when the matching JWK is not an RS256 signing key', async () => {
    vi.mocked(fetch).mockResolvedValue(jwksResponse([{
      ...publicJwk,
      alg: 'RS512',
      use: 'enc',
    }]));
    const provider = await loadProvider();

    await expect(provider.verifyAccessToken(signAccessToken())).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('refreshes JWKS once when a token uses a newly rotated key', async () => {
    const rotatedKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const rotatedKeyId = 'rotated-key-id';
    const rotatedPublicJwk = {
      ...rotatedKeys.publicKey.export({ format: 'jwk' }),
      alg: 'RS256',
      kid: rotatedKeyId,
      use: 'sig',
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jwksResponse())
      .mockResolvedValueOnce(jwksResponse([rotatedPublicJwk]));
    const provider = await loadProvider();

    await expect(provider.verifyAccessToken(signAccessToken({}, {
      signingKey: rotatedKeys.privateKey,
      signingKeyId: rotatedKeyId,
    }))).resolves.toMatchObject({
      subject: 'cognito-sub-1',
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not repeatedly refresh JWKS for sequential tokens with unknown key ids', async () => {
    const provider = await loadProvider();
    const firstUnknownToken = signAccessToken({}, { signingKeyId: 'unknown-key-1' });
    const secondUnknownToken = signAccessToken({}, { signingKeyId: 'unknown-key-2' });

    await expect(provider.verifyAccessToken(firstUnknownToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_TOKEN',
    });
    await expect(provider.verifyAccessToken(secondUnknownToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_TOKEN',
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not start the unknown-kid cooldown when a forced JWKS refresh fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jwksResponse())
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(jwksResponse());
    const provider = await loadProvider();
    const unknownToken = signAccessToken({}, { signingKeyId: 'unknown-key-id' });

    await expect(provider.verifyAccessToken(unknownToken)).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROVIDER_UNAVAILABLE',
    });
    await expect(provider.verifyAccessToken(unknownToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_TOKEN',
    });

    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('shares one in-flight JWKS refresh across concurrent tokens with unknown key ids', async () => {
    let resolveRefresh;
    vi.mocked(fetch)
      .mockResolvedValueOnce(jwksResponse())
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveRefresh = resolve;
      }));
    const provider = await loadProvider();

    await expect(provider.verifyAccessToken(signAccessToken())).resolves.toMatchObject({
      subject: 'cognito-sub-1',
    });

    const firstVerification = provider.verifyAccessToken(
      signAccessToken({}, { signingKeyId: 'unknown-key-1' }),
    );
    const secondVerification = provider.verifyAccessToken(
      signAccessToken({}, { signingKeyId: 'unknown-key-2' }),
    );
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    resolveRefresh(jwksResponse());

    await expect(Promise.allSettled([firstVerification, secondVerification])).resolves.toEqual([
      expect.objectContaining({
        status: 'rejected',
        reason: expect.objectContaining({ statusCode: 401, code: 'INVALID_TOKEN' }),
      }),
      expect.objectContaining({
        status: 'rejected',
        reason: expect.objectContaining({ statusCode: 401, code: 'INVALID_TOKEN' }),
      }),
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight JWKS request across concurrent token verification', async () => {
    let resolveFetch;
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve;
    }));
    const provider = await loadProvider();
    const token = signAccessToken();

    const firstVerification = provider.verifyAccessToken(token);
    const secondVerification = provider.verifyAccessToken(token);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    resolveFetch(jwksResponse());

    await expect(Promise.all([firstVerification, secondVerification])).resolves.toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['network failure', vi.fn().mockRejectedValue(new Error('network down'))],
    ['non-success response', vi.fn().mockResolvedValue({ ok: false })],
    ['invalid JSON', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockRejectedValue(new Error('invalid json')),
    })],
    ['null document', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(null),
    })],
    ['invalid key set', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ keys: null }),
    })],
    ['malformed key element', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ keys: [null] }),
    })],
  ])('fails closed when JWKS has a %s', async (_caseName, fetchImplementation) => {
    vi.stubGlobal('fetch', fetchImplementation);
    const provider = await loadProvider();

    await expect(provider.verifyAccessToken(signAccessToken())).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('globally signs out and deletes a Cognito user through admin commands', async () => {
    const { CognitoIdentityProvider: ProviderClass } = await import(
      '../../../src/services/identityProviders/cognitoProvider.js'
    );
    const sentCommands = [];
    const provider = new ProviderClass({
      userPoolId: 'pool-1',
      adminClient: {
        send: vi.fn().mockImplementation(async (command) => {
          sentCommands.push(command);
          return {};
        }),
      },
    });

    await expect(provider.deleteUser({ username: 'local-sub-1' })).resolves.toEqual({
      deleted: true,
      signedOut: true,
    });

    expect(sentCommands.map((command) => command.constructor.name)).toEqual([
      'AdminUserGlobalSignOutCommand',
      'AdminDeleteUserCommand',
    ]);
    expect(sentCommands[0].input).toEqual({
      UserPoolId: 'pool-1',
      Username: 'local-sub-1',
    });
  });

  it('treats an already-missing Cognito user as idempotent cleanup', async () => {
    const { CognitoIdentityProvider: ProviderClass } = await import(
      '../../../src/services/identityProviders/cognitoProvider.js'
    );
    const provider = new ProviderClass({
      userPoolId: 'pool-1',
      adminClient: {
        send: vi.fn().mockRejectedValue(Object.assign(new Error('missing'), {
          name: 'UserNotFoundException',
        })),
      },
    });

    await expect(provider.deleteUser({ username: 'missing-sub' })).resolves.toEqual({
      deleted: false,
      alreadyMissing: true,
      signedOut: false,
    });
  });
});
