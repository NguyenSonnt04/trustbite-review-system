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

const parseInteger = (value, defaultValue) => Number.parseInt(
  value === undefined || value === '' ? String(defaultValue) : value,
  10,
);

// Express `trust proxy` setting. Deployments behind a reverse proxy / load
// balancer (Nginx, AWS ALB) must set TRUST_PROXY so req.ip reflects the real
// client IP (used by the MULTI_ACCOUNT_SAME_DEVICE anti-fraud signal) instead of
// the proxy IP. Default false (no proxy) is the safe local/no-proxy value and
// avoids trusting spoofable X-Forwarded-For headers.
//   ''/unset -> false; 'true'/'false' -> boolean; digits -> hop count;
//   anything else -> passed through (e.g. 'loopback', '10.0.0.0/8', a CSV list).
const parseTrustProxy = (value) => {
  if (value === undefined || value === '') return false;
  const trimmed = value.trim();
  const lowered = trimmed.toLowerCase();
  if (lowered === 'true') return true;
  if (lowered === 'false') return false;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
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
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  avatarAllowedHosts,
  trustedAuthHeaders: parseBoolean(process.env.TRUSTBITE_TRUSTED_AUTH_HEADERS),
  notifications: {
    enabled: parseBoolean(
      process.env.TRUSTBITE_NOTIFICATIONS_ENABLED,
      env !== 'production',
    ),
  },
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
    },
    adminWeb: {
      cognitoClientId: process.env.AWS_COGNITO_ADMIN_WEB_CLIENT_ID || '',
      cognitoClientSecret: process.env.AWS_COGNITO_ADMIN_WEB_CLIENT_SECRET || '',
      bffSecret: process.env.ADMIN_WEB_BFF_SECRET || '',
      sessionKeySecret: process.env.ADMIN_WEB_SESSION_KEY_SECRET || '',
      sessionMaxSeconds: parseInteger(process.env.ADMIN_WEB_SESSION_MAX_SECONDS, 900),
      loginRateLimitMax: parseInteger(process.env.ADMIN_LOGIN_RATE_LIMIT_MAX, 5),
      loginEmailRateLimitMax: parseInteger(process.env.ADMIN_LOGIN_EMAIL_RATE_LIMIT_MAX, 20),
      loginRateLimitWindowSeconds: parseInteger(
        process.env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        300,
      ),
    }
  }
};
