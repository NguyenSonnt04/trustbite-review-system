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

const avatarAllowedHosts = parseCsv(process.env.TRUSTBITE_AVATAR_ALLOWED_HOSTS)
  .map((host) => host.toLowerCase());

const corsOrigins = parseCsv(process.env.ALLOWED_ORIGINS);

export default {
  port: parseInt(process.env.PORT, 10) || 5000,
  env: process.env.NODE_ENV || 'development',
  corsOrigins,
  avatarAllowedHosts,
  auth: {
    provider: 'cognito',
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
