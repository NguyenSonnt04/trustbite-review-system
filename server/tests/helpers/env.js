import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '../..');

// Keep auth phone fallback disabled by default in tests even when local .env enables
// the development transition flag. Tests that exercise the fallback must opt in
// before importing helpers that load this module.
process.env.AUTH_PHONE_FALLBACK_ENABLED ??= '';

dotenv.config({ path: path.join(serverRoot, '.env') });

process.env.AWS_COGNITO_USER_POOL_ID ||= 'local-test-pool';
process.env.AWS_COGNITO_CLIENT_ID ||= 'local-test-client';
process.env.AWS_REGION ||= 'us-east-1';
