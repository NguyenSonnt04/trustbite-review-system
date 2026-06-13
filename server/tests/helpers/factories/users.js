import { query } from '../db.js';
import crypto from 'node:crypto';

let userSequence = 0;
const phonePrefix = String(crypto.randomInt(0, 100_000_000)).padStart(8, '0');

export async function createUser(overrides = {}) {
  userSequence += 1;
  const phoneNumber = overrides.phoneNumber ?? `+84${phonePrefix}${String(userSequence).padStart(4, '0')}`;

  const result = await query(
    `
    INSERT INTO users (phone_number, display_name, status)
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    [
      phoneNumber,
      overrides.displayName ?? `Test User ${userSequence}`,
      overrides.status ?? 'ACTIVE',
    ],
  );

  return result.rows[0];
}
