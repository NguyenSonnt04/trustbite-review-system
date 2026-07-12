import { afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { disconnectDB } from '../../../src/config/db.js';

describe('PostgreSQL DATE parser', () => {
  afterAll(async () => {
    await disconnectDB();
  });

  it('preserves calendar dates as YYYY-MM-DD strings', () => {
    const parsed = pg.types.getTypeParser(1082)('2004-11-20');

    expect(parsed).toBe('2004-11-20');
    expect(parsed).not.toBeInstanceOf(Date);
  });
});
