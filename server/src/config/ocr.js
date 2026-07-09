// OCR + Redis runtime configuration — values from env only (no literals/secrets).
// Domain code receives these as parameters; it does not read process.env directly.

const int = (name, fallback) => {
  const raw = process.env[name];
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (name, fallback = false) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  return raw.trim().toLowerCase() === 'true';
};

const csv = (value = '') =>
  value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

export function getRedisConnection() {
  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: int('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: int('REDIS_DB', 0),
    // BullMQ requires this for blocking commands.
    maxRetriesPerRequest: null,
  };

  if (bool('REDIS_TLS')) {
    connection.tls = {};
  }

  return connection;
}

export function getOcrConfig() {
  return {
    provider: process.env.OCR_PROVIDER || 'textract',
    queueName: process.env.OCR_QUEUE_NAME || 'receipt-ocr',
    jobAttempts: int('OCR_JOB_ATTEMPTS', 3),
    jobBackoffMs: int('OCR_JOB_BACKOFF_MS', 5000),
    jobTimeoutMs: int('OCR_JOB_TIMEOUT_MS', 30000),
    maxFileBytes: int('OCR_MAX_FILE_BYTES', 10 * 1024 * 1024),
    allowedExtensions: csv(process.env.OCR_ALLOWED_EXTENSIONS || 'jpg,jpeg,png,pdf,tif,tiff'),
  };
}
