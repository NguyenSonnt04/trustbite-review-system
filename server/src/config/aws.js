const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  return value.trim().toLowerCase() === 'true';
};

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
