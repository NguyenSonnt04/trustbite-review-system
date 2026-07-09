import { describe, expect, it } from 'vitest';
import { getDatabaseSslConfig } from '../../../src/config/dbSsl.js';

describe('database SSL config', () => {
  it('keeps local database connections non-SSL by default', () => {
    expect(getDatabaseSslConfig({})).toBe(false);
  });

  it('enables verified TLS when DATABASE_SSL is true', () => {
    expect(getDatabaseSslConfig({ DATABASE_SSL: 'true' })).toEqual({
      rejectUnauthorized: true,
    });
  });

  it('enables verified TLS when PGSSLMODE requires SSL', () => {
    expect(getDatabaseSslConfig({ PGSSLMODE: 'require' })).toEqual({
      rejectUnauthorized: true,
    });
  });

  it('allows an explicit no-verify mode for approved non-production smoke paths', () => {
    expect(getDatabaseSslConfig({
      DATABASE_SSL: 'true',
      DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
    })).toEqual({
      rejectUnauthorized: false,
    });
  });

  it('lets DATABASE_SSL=false override PGSSLMODE for local tooling', () => {
    expect(getDatabaseSslConfig({
      DATABASE_SSL: 'false',
      PGSSLMODE: 'require',
    })).toBe(false);
  });

  it('rejects unrecognized DATABASE_SSL values instead of disabling SSL silently', () => {
    expect(() => getDatabaseSslConfig({ DATABASE_SSL: 'maybe' })).toThrow(
      'DATABASE_SSL must be one of',
    );
  });
});
