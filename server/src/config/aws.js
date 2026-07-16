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

const parseBoundedInteger = (value, {
  defaultValue,
  min,
  max,
}) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : defaultValue;
};

const credentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
  : undefined;
const endpointUrl = process.env.AWS_ENDPOINT_URL || process.env.LOCALSTACK_ENDPOINT_URL;

// AWS credentials are loaded strictly from env (never hardcode secrets).
export default {
  region: process.env.AWS_REGION,
  endpointUrl,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  credentials,
  s3: {
    bucketName: process.env.AWS_S3_BUCKET_NAME,
    endpoint: endpointUrl,
    allowedHosts: parseCsv(process.env.TRUSTBITE_S3_ALLOWED_HOSTS),
    allowedPrefixes: parseCsv(process.env.TRUSTBITE_S3_ALLOWED_PREFIXES),
    forcePathStyle: parseBoolean(process.env.AWS_S3_FORCE_PATH_STYLE, Boolean(endpointUrl)),
  },
  restaurantImages: {
    bucketName: process.env.AWS_RESTAURANT_IMAGES_BUCKET_NAME,
    signedUrlTtlSeconds: parseBoundedInteger(
      process.env.TRUSTBITE_RESTAURANT_IMAGE_SIGNED_URL_TTL_SECONDS,
      {
        defaultValue: 900,
        min: 60,
        max: 3600,
      },
    ),
  },
  merchantClaims: {
    signedUrlTtlSeconds: parseBoundedInteger(
      process.env.TRUSTBITE_MERCHANT_CLAIM_SIGNED_URL_TTL_SECONDS,
      {
        defaultValue: 900,
        min: 60,
        max: 3600,
      },
    ),
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
