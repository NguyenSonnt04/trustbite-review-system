// Textract OCR provider adapter. Loads the receipt object from S3 and runs
// AnalyzeExpense, returning the normalized OCR struct. This is the only place a
// Textract/S3 client is instantiated — controllers/routes never touch it.

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, AnalyzeExpenseCommand } from '@aws-sdk/client-textract';
import awsConfig from '../../config/aws.js';
import { mapAnalyzeExpense } from './ocrMapping.js';

let s3Client = null;
let textractClient = null;

function clientConfig() {
  const cfg = { region: awsConfig.region };
  // Local/dev may point at LocalStack via AWS_ENDPOINT_URL; absent in prod.
  if (awsConfig.endpointUrl) {
    cfg.endpoint = awsConfig.endpointUrl;
    cfg.forcePathStyle = true;
  }
  if (awsConfig.accessKeyId && awsConfig.secretAccessKey) {
    cfg.credentials = {
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey,
    };
  }
  return cfg;
}

function getS3() {
  if (!s3Client) s3Client = new S3Client(clientConfig());
  return s3Client;
}

function getTextract() {
  if (!textractClient) textractClient = new TextractClient(clientConfig());
  return textractClient;
}

/**
 * Resolve an S3 { bucket, key } from a stored file_url. Supports:
 *  - s3://bucket/key
 *  - bare key (uses the configured default bucket)
 */
export function resolveS3Location(fileUrl) {
  if (!fileUrl) throw new Error('Receipt file_url is empty.');
  if (fileUrl.startsWith('s3://')) {
    const without = fileUrl.slice('s3://'.length);
    const slash = without.indexOf('/');
    if (slash < 0) throw new Error(`Malformed s3 url: ${fileUrl}`);
    return { bucket: without.slice(0, slash), key: without.slice(slash + 1) };
  }
  const bucket = awsConfig.s3.bucketName;
  if (!bucket) throw new Error('AWS_S3_BUCKET_NAME is not configured.');
  return { bucket, key: fileUrl.replace(/^\/+/, '') };
}

async function streamToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export class TextractOcrProvider {
  provider = 'textract';

  /**
   * Load the receipt bytes from S3. Kept separate from analyzeExpense so the
   * pipeline can compute the SHA-256 file hash and run the layer-1 duplicate
   * check before paying for the (slow, billable) OCR call.
   * @param {object} input
   * @param {string} input.fileUrl - s3://bucket/key or bare key
   * @returns {Promise<Buffer>}
   */
  async loadFile({ fileUrl }) {
    const { bucket, key } = resolveS3Location(fileUrl);
    const object = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return streamToBuffer(object.Body);
  }

  /**
   * Run AnalyzeExpense over already-loaded bytes (preferred) or by re-loading
   * from S3 when bytes are not supplied.
   * @returns {Promise<object>} normalized OCR struct
   */
  async analyzeExpense({ fileUrl, bytes }) {
    const documentBytes = bytes ?? (await this.loadFile({ fileUrl }));
    const response = await getTextract().send(
      new AnalyzeExpenseCommand({ Document: { Bytes: documentBytes } }),
    );
    return mapAnalyzeExpense(response);
  }
}

export const textractOcrProvider = new TextractOcrProvider();
