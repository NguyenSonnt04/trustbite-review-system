import { pool, disconnectDB } from '../../src/config/db.js';

function ensureTestEnvironment() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Destructive test database helpers require NODE_ENV=test.');
  }
}

export function query(sql, params = []) {
  return pool.query(sql, params);
}

export async function deleteByIds(tableName, idColumn, ids = []) {
  ensureTestEnvironment();
  if (!Array.isArray(ids) || ids.length === 0) return;
  await pool.query(
    `DELETE FROM ${tableName} WHERE ${idColumn} = ANY($1::uuid[])`,
    [ids],
  );
}

export async function closeDbPool() {
  await disconnectDB();
}
