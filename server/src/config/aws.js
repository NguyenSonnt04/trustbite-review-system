const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  return value.trim().toLowerCase() === 'true';
};

const parseCsv = (value = '') => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const credentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
  : undefined;

// AWS credentials are loaded strictly from env (never hardcode secrets).
export default {
  region: process.env.AWS_REGION,
  endpointUrl: process.env.AWS_ENDPOINT_URL || process.env.LOCALSTACK_ENDPOINT_URL,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  credentials,
  s3: {
    bucketName: process.env.AWS_S3_BUCKET_NAME,
    endpoint: process.env.AWS_ENDPOINT_URL,
    allowedHosts: parseCsv(process.env.TRUSTBITE_S3_ALLOWED_HOSTS),
    allowedPrefixes: parseCsv(process.env.TRUSTBITE_S3_ALLOWED_PREFIXES),
    forcePathStyle: parseBoolean(process.env.AWS_S3_FORCE_PATH_STYLE, Boolean(
      process.env.AWS_ENDPOINT_URL || process.env.LOCALSTACK_ENDPOINT_URL,
    )),
  },
  cognito: {
    userPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
    clientId: process.env.AWS_COGNITO_CLIENT_ID
  },
  ses: {
    senderEmail: process.env.AWS_SES_SENDER_EMAIL
  },
  bedrock: {
    modelId: process.env.AWS_BEDROCK_MODEL_ID
  }
};
