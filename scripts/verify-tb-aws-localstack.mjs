#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const npmCliPath = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const npmCommand = process.platform === 'win32' && existsSync(npmCliPath)
  ? process.execPath
  : 'npm';
const localStackEndpoint = process.env.LOCALSTACK_ENDPOINT_URL || 'http://127.0.0.1:4566';

const run = (label, args, options = {}) => {
  console.log(`[tb-aws] ${label}`);
  const npmArgs = npmCommand === process.execPath ? [npmCliPath, ...args] : args;
  const result = spawnSync(npmCommand, npmArgs, {
    cwd: process.cwd(),
    env: options.env ?? process.env,
    shell: false,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`[tb-aws] ${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[tb-aws] ${label} exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
};

const runNode = (label, args, options = {}) => {
  console.log(`[tb-aws] ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: options.env ?? process.env,
    shell: false,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`[tb-aws] ${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[tb-aws] ${label} exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
};

const waitForLocalStack = async (services) => {
  const healthUrl = new URL('/_localstack/health', localStackEndpoint).toString();
  const deadline = Date.now() + 30000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        const health = await response.json();
        const allReady = services.every((service) => (
          health.services?.[service] === 'available' || health.services?.[service] === 'running'
        ));
        if (allReady) {
          const statuses = services
            .map((service) => `${service}=${health.services[service]}`)
            .join(', ');
          console.log(`[tb-aws] LocalStack health: ${statuses}`);
          return health;
        }
        const statuses = services
          .map((service) => `${service}=${health.services?.[service] ?? 'missing'}`)
          .join(', ');
        lastError = new Error(`service health not ready: ${statuses}`);
      } else {
        lastError = new Error(`health endpoint returned ${response.status}`);
      }
    } catch (err) {
      lastError = err;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
  }

  console.error(`[tb-aws] LocalStack services were not available at ${healthUrl}: ${lastError?.message ?? 'unknown error'}`);
  process.exit(1);
};

run('start Docker/LocalStack services', ['run', 'docker:up']);
const health = await waitForLocalStack(['s3', 'ses']);
const unclaimedStatuses = ['cognito-idp', 'textract', 'bedrock']
  .map((service) => `${service}=${health.services?.[service] ?? 'missing'}`)
  .join(', ');
console.log(`[tb-aws] LocalStack unclaimed provider statuses: ${unclaimedStatuses}`);

runNode('AWS SDK provider boundary audit', ['scripts/audit-aws-provider-boundaries.mjs']);

run('targeted S3/SES/Textract/Cognito/config unit proof', [
  'run',
  'test',
  '--prefix',
  'server',
  '--',
  'tests/unit/config/awsConfig.test.js',
  'tests/unit/storage/objectStorage.test.js',
  'tests/unit/receiptStorageService.test.js',
  'tests/unit/messaging/sesEmailProvider.test.js',
  'tests/unit/receipt/textractProvider.test.js',
  'tests/unit/receipt/ocrMapping.test.js',
  'tests/unit/auth/cognitoProvider.test.js',
]);

const smokeEnv = {
  ...process.env,
  RUN_LOCALSTACK_PROVIDER_SMOKE: 'true',
  LOCALSTACK_ENDPOINT_URL: localStackEndpoint,
  AWS_REGION: process.env.AWS_REGION || 'ap-southeast-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || `localstack-${crypto.randomUUID()}`,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || `localstack-${crypto.randomUUID()}`,
};
delete smokeEnv.AWS_ENDPOINT_URL;

run('S3 LocalStack receipt storage smoke', [
  'run',
  'test',
  '--prefix',
  'server',
  '--',
  'tests/integration/providerCleanupLocalStack.integration.test.js',
  '-t',
  'S3',
], { env: smokeEnv });

run('Cognito LocalStack support classification smoke', [
  'run',
  'test',
  '--prefix',
  'server',
  '--',
  'tests/integration/providerCleanupLocalStack.integration.test.js',
  '-t',
  'Cognito',
], { env: smokeEnv });

run('SES LocalStack email provider smoke', [
  'run',
  'test',
  '--prefix',
  'server',
  '--',
  'tests/integration/sesLocalStack.integration.test.js',
], { env: smokeEnv });

run('server syntax check', ['run', 'server:build']);

console.log('[tb-aws] AWS LocalStack verification passed for claimed S3 and SES provider boundaries.');
