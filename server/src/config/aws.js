// AWS credentials — loaded strictly from .env (never hardcode secrets)
export default {
  region: process.env.AWS_REGION,
  endpointUrl: process.env.AWS_ENDPOINT_URL,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3: {
    bucketName: process.env.AWS_S3_BUCKET_NAME
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
