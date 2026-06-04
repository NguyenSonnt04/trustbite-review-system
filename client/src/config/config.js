const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  aws: {
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-southeast-1',
    cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
    },
  },
  mapApiKey: process.env.NEXT_PUBLIC_MAP_API_KEY || '',
};

export default config;
