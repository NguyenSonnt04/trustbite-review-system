import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sesSend: vi.fn(),
  sendEmailCommand: vi.fn((input) => ({ input })),
}));

vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: vi.fn(function SESClient() {
    this.send = mocks.sesSend;
  }),
  SendEmailCommand: vi.fn(function SendEmailCommand(input) {
    mocks.sendEmailCommand(input);
    this.input = input;
  }),
}));

const { SesEmailProvider } = await import('../../../src/services/messaging/sesEmailProvider.js');

describe('SesEmailProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sesSend.mockResolvedValue({ MessageId: 'message-1' });
  });

  it('sends email through SES with configured source and normalized destination', async () => {
    const provider = new SesEmailProvider({
      senderEmail: 'noreply@example.test',
    });

    await expect(provider.sendEmail({
      to: 'user@example.test',
      subject: 'Verify your email',
      textBody: 'Use this code.',
    })).resolves.toEqual({
      provider: 'ses',
      messageId: 'message-1',
    });

    expect(mocks.sendEmailCommand).toHaveBeenCalledWith({
      Source: 'noreply@example.test',
      Destination: {
        ToAddresses: ['user@example.test'],
      },
      Message: {
        Subject: {
          Data: 'Verify your email',
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: 'Use this code.',
            Charset: 'UTF-8',
          },
        },
      },
    });
  });

  it('fails closed when SES sender config is missing', async () => {
    const provider = new SesEmailProvider({
      senderEmail: '',
    });

    await expect(provider.sendEmail({
      to: 'user@example.test',
      subject: 'Verify your email',
      textBody: 'Use this code.',
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROVIDER_UNAVAILABLE',
    });

    expect(mocks.sesSend).not.toHaveBeenCalled();
  });

  it('maps SES send failures to a structured provider error', async () => {
    mocks.sesSend.mockRejectedValue(new Error('raw provider failure'));
    const provider = new SesEmailProvider({
      senderEmail: 'noreply@example.test',
    });

    await expect(provider.sendEmail({
      to: 'user@example.test',
      subject: 'Verify your email',
      textBody: 'Use this code.',
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Email provider is unavailable.',
    });
  });
});
