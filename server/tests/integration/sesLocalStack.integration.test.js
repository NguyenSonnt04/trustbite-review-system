import '../helpers/env.js';
import crypto from 'node:crypto';
import {
  DeleteIdentityCommand,
  SESClient,
  VerifyEmailIdentityCommand,
} from '@aws-sdk/client-ses';
import { describe, expect, it } from 'vitest';

import { SesEmailProvider } from '../../src/services/messaging/sesEmailProvider.js';

const shouldRunLocalStackSmoke = process.env.RUN_LOCALSTACK_PROVIDER_SMOKE === 'true';
const localStackEndpoint = process.env.AWS_ENDPOINT_URL || process.env.LOCALSTACK_ENDPOINT_URL || 'http://127.0.0.1:4566';
const region = process.env.AWS_REGION || 'ap-southeast-1';
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || `localstack-${crypto.randomUUID()}`,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || `localstack-${crypto.randomUUID()}`,
};
const smokeName = `tb-aws-ses-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const sesClient = () => new SESClient({
  endpoint: localStackEndpoint,
  region,
  credentials,
});

describe.skipIf(!shouldRunLocalStackSmoke)('SES LocalStack smoke', () => {
  it('sends a message through the SES provider boundary', async () => {
    const senderEmail = `${smokeName}@example.test`;
    const recipientEmail = `${smokeName}-recipient@example.test`;
    const client = sesClient();

    try {
      await client.send(new VerifyEmailIdentityCommand({
        EmailAddress: senderEmail,
      }));
      const provider = new SesEmailProvider({
        client,
        senderEmail,
        region,
      });

      await expect(provider.sendEmail({
        to: recipientEmail,
        subject: 'TrustBite LocalStack SES smoke',
        textBody: 'Local provider smoke message.',
      })).resolves.toMatchObject({
        provider: 'ses',
        messageId: expect.any(String),
      });
    } finally {
      await client.send(new DeleteIdentityCommand({
        Identity: senderEmail,
      })).catch(() => {});
      client.destroy();
    }
  });
});
