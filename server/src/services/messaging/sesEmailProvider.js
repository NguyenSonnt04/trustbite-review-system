import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import awsConfig from '../../config/aws.js';
import { createHttpError } from '../../utils/httpErrors.js';

const buildMessageBody = ({ textBody, htmlBody }) => {
  const body = {};
  if (textBody) {
    body.Text = {
      Data: textBody,
      Charset: 'UTF-8',
    };
  }
  if (htmlBody) {
    body.Html = {
      Data: htmlBody,
      Charset: 'UTF-8',
    };
  }
  return body;
};

export class SesEmailProvider {
  provider = 'ses';

  constructor({
    client = null,
    senderEmail = awsConfig.ses.senderEmail,
    region = awsConfig.region,
    endpoint = awsConfig.endpointUrl,
    credentials = awsConfig.credentials,
  } = {}) {
    this.client = client;
    this.senderEmail = senderEmail;
    this.region = region;
    this.endpoint = endpoint;
    this.credentials = credentials;
  }

  getClient() {
    if (!this.client) {
      const config = { region: this.region };
      if (this.endpoint) {
        config.endpoint = this.endpoint;
      }
      if (this.credentials) {
        config.credentials = this.credentials;
      }
      this.client = new SESClient(config);
    }
    return this.client;
  }

  async sendEmail({
    to,
    subject,
    textBody,
    htmlBody,
  }) {
    if (!this.senderEmail) {
      throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Email sender is not configured.');
    }
    if (!to || !subject || (!textBody && !htmlBody)) {
      throw createHttpError(400, 'INVALID_EMAIL_MESSAGE', 'Email recipient, subject, and body are required.');
    }

    try {
      const result = await this.getClient().send(new SendEmailCommand({
        Source: this.senderEmail,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: buildMessageBody({ textBody, htmlBody }),
        },
      }));

      return {
        provider: this.provider,
        messageId: result.MessageId,
      };
    } catch {
      throw createHttpError(503, 'PROVIDER_UNAVAILABLE', 'Email provider is unavailable.');
    }
  }
}

export const sesEmailProvider = new SesEmailProvider();
