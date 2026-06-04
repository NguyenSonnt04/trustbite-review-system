import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

const connectDB = async () => {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT NOW()');
    console.log(`[DB] Connected — ${res.rows[0].now}`);
  } finally {
    client.release();
  }
};

const disconnectDB = async () => {
  await pool.end();
  console.log('[DB] Pool closed');
};

export { pool, connectDB, disconnectDB };
