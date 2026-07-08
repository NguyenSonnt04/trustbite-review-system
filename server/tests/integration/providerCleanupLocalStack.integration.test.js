import '../helpers/env.js';
import crypto from 'node:crypto';
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  CreateUserPoolCommand,
  DeleteUserPoolCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { describe, expect, it, vi } from 'vitest';

import { CognitoIdentityProvider } from '../../src/services/identityProviders/cognitoProvider.js';
import { S3ObjectStorage } from '../../src/services/objectStorage.js';

const shouldRunLocalStackSmoke = process.env.RUN_LOCALSTACK_PROVIDER_SMOKE === 'true';
const localStackEndpoint = process.env.AWS_ENDPOINT_URL || process.env.LOCALSTACK_ENDPOINT_URL || 'http://127.0.0.1:4566';
const region = process.env.AWS_REGION || 'ap-southeast-1';
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || `localstack-${crypto.randomUUID()}`,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || `localstack-${crypto.randomUUID()}`,
};
const smokeName = `tb-privacy-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const s3Client = () => new S3Client({
  endpoint: localStackEndpoint,
  forcePathStyle: true,
  region,
  credentials,
});

const cognitoClient = () => new CognitoIdentityProviderClient({
  endpoint: localStackEndpoint,
  region,
  credentials,
});

describe.skipIf(!shouldRunLocalStackSmoke)('provider cleanup LocalStack smoke', () => {
  it('uploads and deletes a receipt object through the S3 receipt storage config boundary', async () => {
    const bucketName = `${smokeName}-receipts`;
    const key = `receipts/${smokeName}/receipt.jpg`;
    const client = s3Client();
    const previousEnv = {
      AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL,
      LOCALSTACK_ENDPOINT_URL: process.env.LOCALSTACK_ENDPOINT_URL,
      AWS_REGION: process.env.AWS_REGION,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
      AWS_S3_FORCE_PATH_STYLE: process.env.AWS_S3_FORCE_PATH_STYLE,
    };

    await client.send(new CreateBucketCommand({ Bucket: bucketName }));

    try {
      delete process.env.AWS_ENDPOINT_URL;
      process.env.LOCALSTACK_ENDPOINT_URL = localStackEndpoint;
      process.env.AWS_REGION = region;
      process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
      process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;
      process.env.AWS_S3_BUCKET_NAME = bucketName;
      delete process.env.AWS_S3_FORCE_PATH_STYLE;
      vi.resetModules();

      const receiptStorage = await import('../../src/services/s3ReceiptStorageService.js?localstack-s3-receipt');

      await expect(receiptStorage.uploadReceiptObject({
        key,
        body: Buffer.from('receipt bytes'),
        contentType: 'image/jpeg',
      })).resolves.toBe(`s3://${bucketName}/${key}`);

      await expect(client.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      }))).resolves.toBeTruthy();

      await receiptStorage.deleteReceiptObject({ fileUrl: `s3://${bucketName}/${key}` });

      await expect(client.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      }))).rejects.toMatchObject({
        name: expect.stringMatching(/NotFound|NoSuchKey|404/),
      });
    } finally {
      for (const [name, value] of Object.entries(previousEnv)) {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
      vi.resetModules();
      await client.send(new DeleteBucketCommand({ Bucket: bucketName })).catch(() => {});
      client.destroy();
    }
  });

  it('deletes a configured TrustBite-owned object through real LocalStack S3', async () => {
    const bucketName = `${smokeName}-bucket`;
    const key = 'avatars/localstack-delete-me.png';
    const client = s3Client();
    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from('delete me'),
      ContentType: 'image/png',
    }));

    try {
      await expect(client.send(new HeadBucketCommand({ Bucket: bucketName }))).resolves.toBeTruthy();
      const storage = new S3ObjectStorage({ bucketName, region, client });

      await expect(storage.deleteOwnedObject(`s3://${bucketName}/${key}`)).resolves.toEqual({
        deleted: true,
      });

      await expect(client.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      }))).rejects.toMatchObject({
        name: expect.stringMatching(/NotFound|NoSuchKey|404/),
      });
    } finally {
      await client.send(new DeleteBucketCommand({ Bucket: bucketName })).catch(() => {});
      client.destroy();
    }
  });

  it('globally signs out and deletes a Cognito user by sub or documents the LocalStack Cognito blocker', async () => {
    const client = cognitoClient();
    let userPoolId;

    try {
      let pool;
      try {
        pool = await client.send(new CreateUserPoolCommand({
          PoolName: `${smokeName}-pool`,
        }));
      } catch (err) {
        expect(err).toMatchObject({
          name: 'InternalFailure',
        });
        expect(err.message).toMatch(/cognito-idp.*current license plan|cognito-idp.*not yet been emulated/i);
        return;
      }
      userPoolId = pool.UserPool.Id;

      const created = await client.send(new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: `${smokeName}-user`,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: `${smokeName}@example.test` },
          { Name: 'email_verified', Value: 'true' },
        ],
      }));
      const subject = created.User.Attributes.find((attribute) => attribute.Name === 'sub')?.Value;
      expect(subject).toBeTruthy();

      const provider = new CognitoIdentityProvider({
        userPoolId,
        adminClient: client,
      });

      await expect(provider.deleteUser({ username: subject })).resolves.toMatchObject({
        deleted: true,
      });

      await expect(client.send(new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: subject,
      }))).rejects.toMatchObject({
        name: 'UserNotFoundException',
      });
    } finally {
      if (userPoolId) {
        await client.send(new DeleteUserPoolCommand({ UserPoolId: userPoolId })).catch(() => {});
      }
      client.destroy();
    }
  });
});
