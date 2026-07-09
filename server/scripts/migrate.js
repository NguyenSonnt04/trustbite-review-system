import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { getDatabaseSslConfig } from '../src/config/dbSsl.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(serverRoot, 'migrations');

dotenv.config({ path: path.join(serverRoot, '.env') });

const requiredEnv = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME'
];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`[DB] Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT, 10),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: getDatabaseSslConfig(),
  max: 1,
  connectionTimeoutMillis: 5000
});

const ensureMigrationsTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

const getAppliedVersions = async (client) => {
  const result = await client.query('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(result.rows.map((row) => row.version));
};

const listMigrationFiles = async () => {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
};

const runMigration = async (client, fileName) => {
  const version = fileName.replace(/\.sql$/u, '');
  const sql = await fs.readFile(path.join(migrationsDir, fileName), 'utf8');

  console.log(`[DB] Applying ${fileName}`);
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

const migrate = async () => {
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);

    const appliedVersions = await getAppliedVersions(client);
    const migrationFiles = await listMigrationFiles();
    let appliedCount = 0;

    for (const fileName of migrationFiles) {
      const version = fileName.replace(/\.sql$/u, '');
      if (appliedVersions.has(version)) {
        console.log(`[DB] Skipping ${fileName}`);
        continue;
      }

      await runMigration(client, fileName);
      appliedCount += 1;
    }

    console.log(`[DB] Migration complete. Applied ${appliedCount} migration(s).`);
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch((error) => {
  console.error('[DB] Migration failed:', error.message);
  process.exit(1);
});

