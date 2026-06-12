import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load server/.env so config/app.js (which requires Cognito/AWS vars at import)
// can construct, and so DB/Redis/OCR settings are available to tests.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Force test environment: destructive DB helpers and the OCR mock provider both
// gate on NODE_ENV === 'test'.
process.env.NODE_ENV = 'test';
// Integration/unit tests must never reach a real OCR provider.
process.env.OCR_PROVIDER = process.env.OCR_PROVIDER || 'mock';
