const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  aws: {
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-southeast-1',
    cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
      domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '',
      redirectUri: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI || '',
    },
  },
  trustedDevelopmentHeadersEnabled:
    process.env.NODE_ENV === 'development'
    && process.env.NEXT_PUBLIC_TRUSTBITE_TRUSTED_AUTH_HEADERS === 'true',
  trustedDevelopmentUserId: process.env.NEXT_PUBLIC_TRUSTBITE_DEV_USER_ID || '',
  mapApiKey: process.env.NEXT_PUBLIC_MAP_API_KEY || '',
};

export default config;
