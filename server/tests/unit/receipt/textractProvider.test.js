import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  textractSend: vi.fn(),
  analyzeExpenseCommand: vi.fn((input) => ({ input })),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function S3Client() {
    this.send = vi.fn();
  }),
  GetObjectCommand: vi.fn(function GetObjectCommand(input) {
    this.input = input;
  }),
}));

vi.mock('@aws-sdk/client-textract', () => ({
  TextractClient: vi.fn(function TextractClient() {
    this.send = mocks.textractSend;
  }),
  AnalyzeExpenseCommand: vi.fn(function AnalyzeExpenseCommand(input) {
    mocks.analyzeExpenseCommand(input);
    this.input = input;
  }),
}));

const { TextractOcrProvider } = await import('../../../src/services/providers/textractProvider.js');

describe('TextractOcrProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.textractSend.mockResolvedValue({ ExpenseDocuments: [] });
  });

  it('sends PNG/JPEG receipts as Document.Bytes to AnalyzeExpense', async () => {
    const bytes = Buffer.from('image');
    await new TextractOcrProvider().analyzeExpense({
      fileUrl: 's3://trustbite-invoices/receipts/r.jpg',
      bytes,
    });

    expect(mocks.analyzeExpenseCommand).toHaveBeenCalledWith({
      Document: { Bytes: bytes },
    });
  });

  it('sends PDF receipts as Document.S3Object to AnalyzeExpense', async () => {
    await new TextractOcrProvider().analyzeExpense({
      fileUrl: 's3://trustbite-invoices/receipts/r.pdf',
      bytes: Buffer.from('pdf'),
    });

    expect(mocks.analyzeExpenseCommand).toHaveBeenCalledWith({
      Document: {
        S3Object: {
          Bucket: 'trustbite-invoices',
          Name: 'receipts/r.pdf',
        },
      },
    });
  });

  it('sends TIFF receipts as Document.S3Object to AnalyzeExpense', async () => {
    await new TextractOcrProvider().analyzeExpense({
      fileUrl: 's3://trustbite-invoices/receipts/r.tiff',
      bytes: Buffer.from('tiff'),
    });

    expect(mocks.analyzeExpenseCommand).toHaveBeenCalledWith({
      Document: {
        S3Object: {
          Bucket: 'trustbite-invoices',
          Name: 'receipts/r.tiff',
        },
      },
    });
  });
});
