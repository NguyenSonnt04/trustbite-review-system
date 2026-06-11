import { query } from '../db.js';

let userSequence = 0;

export async function createUser(overrides = {}) {
  userSequence += 1;
  const phoneNumber = overrides.phoneNumber ?? `+8490000${String(userSequence).padStart(5, '0')}`;

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
