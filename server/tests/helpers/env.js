import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(serverRoot, '.env') });

process.env.AWS_COGNITO_USER_POOL_ID ??= 'local-test-pool';
process.env.AWS_COGNITO_CLIENT_ID ??= 'local-test-client';
process.env.AWS_REGION ??= 'us-east-1';
