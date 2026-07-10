import { describe, expect, it } from 'vitest';

import { normalizeIpAddress } from '../../../src/utils/net.js';

describe('normalizeIpAddress', () => {
  it('returns null for null/undefined/empty', () => {
    expect(normalizeIpAddress(null)).toBeNull();
    expect(normalizeIpAddress(undefined)).toBeNull();
    expect(normalizeIpAddress('')).toBeNull();
    expect(normalizeIpAddress('   ')).toBeNull();
  });

  it('collapses IPv4-mapped IPv6 to plain IPv4 (direct-socket vs proxy consistency)', () => {
    expect(normalizeIpAddress('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIpAddress('::FFFF:203.0.113.7')).toBe('203.0.113.7');
  });

  it('leaves plain IPv4 unchanged and trims surrounding whitespace', () => {
    expect(normalizeIpAddress('203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIpAddress('  203.0.113.7  ')).toBe('203.0.113.7');
  });

  it('leaves genuine IPv6 addresses unchanged', () => {
    expect(normalizeIpAddress('2001:db8::1')).toBe('2001:db8::1');
    expect(normalizeIpAddress('::1')).toBe('::1');
  });

  it('produces the same value for the mapped and plain form of one client', () => {
    expect(normalizeIpAddress('::ffff:198.51.100.9')).toBe(normalizeIpAddress('198.51.100.9'));
  });
});
