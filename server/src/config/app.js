// App configuration — sensitive values loaded strictly from .env
const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${name}`);
  }

  return value;
};

const cognitoUserPoolId = requireEnv('AWS_COGNITO_USER_POOL_ID');
const cognitoClientId = requireEnv('AWS_COGNITO_CLIENT_ID');
const cognitoRegion = requireEnv('AWS_REGION');

const parseCsv = (value = '') => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value.trim().toLowerCase() === 'true';
};

const explicitNodeEnv = process.env.NODE_ENV;
const env = explicitNodeEnv || 'development';
const phoneFallbackDefault = ['development', 'test'].includes(explicitNodeEnv);

const avatarAllowedHosts = parseCsv(process.env.TRUSTBITE_AVATAR_ALLOWED_HOSTS)
  .map((host) => host.toLowerCase());

const corsOrigins = parseCsv(process.env.ALLOWED_ORIGINS);

if (env === 'production' && corsOrigins.length === 0) {
  throw new Error('[Config] ALLOWED_ORIGINS must be configured in production');
}

export default {
  port: parseInt(process.env.PORT, 10) || 5000,
  env,
  corsOrigins,
  avatarAllowedHosts,
  trustedAuthHeaders: parseBoolean(process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS),
  auth: {
    provider: 'cognito',
    phoneFallbackEnabled: parseBoolean(process.env.AUTH_PHONE_FALLBACK_ENABLED, phoneFallbackDefault),
    cognito: {
      userPoolId: cognitoUserPoolId,
      clientId: cognitoClientId,
      audience: cognitoClientId,
      region: cognitoRegion,
      issuer: `https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}`,
      jwksUri: `https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}/.well-known/jwks.json`
    }
  }
};
