// App configuration — sensitive values loaded strictly from .env
export default {
  port: parseInt(process.env.PORT, 10) || 5000,
  env: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.ALLOWED_ORIGINS,
  auth: {
    provider: 'cognito',
    cognito: {
      userPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
      clientId: process.env.AWS_COGNITO_CLIENT_ID,
      region: process.env.AWS_REGION,
      issuer: process.env.AWS_COGNITO_USER_POOL_ID && process.env.AWS_REGION
        ? `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_COGNITO_USER_POOL_ID}`
        : undefined,
      jwksUri: process.env.AWS_COGNITO_USER_POOL_ID && process.env.AWS_REGION
        ? `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_COGNITO_USER_POOL_ID}/.well-known/jwks.json`
        : undefined
    }
  }
};
