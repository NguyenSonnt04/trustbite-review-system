#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { getDatabaseSslConfig } from '../src/config/dbSsl.js';

const serverRequire = createRequire(new URL('../package.json', import.meta.url));
const serverDir = fileURLToPath(new URL('..', import.meta.url));
const pg = serverRequire('pg');
const Redis = serverRequire('ioredis');
const {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} = serverRequire('@aws-sdk/client-s3');

const args = new Set(process.argv.slice(2));
const envName = process.argv.includes('--env')
  ? process.argv[process.argv.indexOf('--env') + 1]
  : process.env.TRUSTBITE_ENV || 'dev';

const required = [
  'TRUSTBITE_API_BASE_URL',
  'DATABASE_HOST',
    'DATABASE_USER',
    'DATABASE_PASSWORD',
    'DATABASE_NAME',
    'DATABASE_SSL',
    'AWS_REGION',
  'AWS_S3_BUCKET_NAME',
  'REDIS_HOST',
  'REDIS_PASSWORD',
  'REDIS_TLS',
  'TRUSTBITE_SMOKE_NETWORK_CONTEXT',
];

const allowedNetworkContexts = new Set([
  'ecs-run-task',
  'bastion-vpn',
  'runner-security-group',
]);

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`[tb-smoke] missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

if (!allowedNetworkContexts.has(process.env.TRUSTBITE_SMOKE_NETWORK_CONTEXT)) {
  console.error('[tb-smoke] TRUSTBITE_SMOKE_NETWORK_CONTEXT must be ecs-run-task, bastion-vpn, or runner-security-group.');
  process.exit(1);
}

if (process.env.REDIS_TLS !== 'true') {
  console.error('[tb-smoke] REDIS_TLS must be set to true for live ElastiCache Redis smoke.');
  process.exit(1);
}

if (process.env.DATABASE_SSL !== 'true') {
  console.error('[tb-smoke] DATABASE_SSL must be set to true for live RDS smoke.');
  process.exit(1);
}

const apiBaseUrl = process.env.TRUSTBITE_API_BASE_URL.replace(/\/+$/, '');
const receiptPrefix = process.env.SMOKE_RECEIPT_PREFIX || 'receipts/smoke/';
const smokeId = `${envName}-${Date.now()}-${randomUUID()}`;
const s3Key = `${receiptPrefix}${smokeId}.txt`;
const redisKey = `trustbite:smoke:${smokeId}`;

const run = (label, fn) => {
  console.log(`[tb-smoke] ${label}`);
  return fn();
};

const streamToString = async (stream) => {
  if (typeof stream?.transformToString === 'function') {
    return stream.transformToString();
  }

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

const migrate = () => {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'db:migrate'], {
    cwd: serverDir,
    env: process.env,
    shell: false,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`db:migrate exited with status ${result.status}`);
  }
};

let pool;
let redis;
let s3;

try {
  await run('API health through deployed ingress', async () => {
    const response = await fetch(`${apiBaseUrl}/health`);
    if (!response.ok) {
      throw new Error(`GET /health returned ${response.status}`);
    }
  });

  await run('RDS migration against configured database', async () => {
    migrate();
  });

  await run('RDS/PostGIS query', async () => {
    pool = new pg.Pool({
      host: process.env.DATABASE_HOST,
      port: Number.parseInt(process.env.DATABASE_PORT || '5432', 10),
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        ssl: getDatabaseSslConfig(),
        connectionTimeoutMillis: 10000,
      max: 2,
    });

    const { rows } = await pool.query(`
      SELECT
        current_database() AS database_name,
        EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS has_postgis,
        EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS has_pgcrypto
    `);

    if (!rows[0]?.has_postgis || !rows[0]?.has_pgcrypto) {
      throw new Error('RDS is missing required postgis or pgcrypto extension');
    }
  });

  await run('S3 receipt fixture write/read/delete', async () => {
    s3 = new S3Client({
      region: process.env.AWS_REGION,
      endpoint: process.env.AWS_ENDPOINT_URL || undefined,
      forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
    });

    const body = `trustbite smoke ${smokeId}\n`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
      Body: body,
      ContentType: 'text/plain',
    }));

    const fetched = await s3.send(new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
    }));
    const text = await streamToString(fetched.Body);
    if (text !== body) {
      throw new Error('S3 smoke fixture read did not match written body');
    }
  });

  await run('Redis/BullMQ backend connection', async () => {
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number.parseInt(process.env.REDIS_DB || '0', 10),
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      connectTimeout: 10000,
      commandTimeout: 10000,
      maxRetriesPerRequest: 1,
    });

    await redis.set(redisKey, smokeId, 'EX', 60);
    const value = await redis.get(redisKey);
    if (value !== smokeId) {
      throw new Error('Redis smoke value did not round-trip');
    }
  });

  console.log('[tb-smoke] live AWS MVP smoke passed');
  if (!args.has('--skip-cloudwatch-note')) {
    console.log('[tb-smoke] manual follow-up required: inspect API and worker CloudWatch logs for secret/token/receipt redaction.');
  }
} finally {
  if (s3) {
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
    })).catch((err) => console.error(`[tb-smoke] S3 cleanup failed for ${s3Key}: ${err.message}`));
  }

  if (redis) {
    await redis.del(redisKey).catch((err) => console.error(`[tb-smoke] Redis cleanup failed for ${redisKey}: ${err.message}`));
    redis.disconnect();
  }

  if (pool) {
    await pool.end().catch((err) => console.error(`[tb-smoke] DB pool cleanup failed: ${err.message}`));
  }
}
