/**
 * net.js — request network helpers.
 */

const IPV4_MAPPED_IPV6 = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;

/**
 * Normalize a client IP into a stable representation before it is persisted to
 * an INET column and later compared for the MULTI_ACCOUNT_SAME_DEVICE signal.
 *
 * Node/Express can report an IPv4 client as an IPv4-mapped IPv6 address
 * (e.g. `::ffff:203.0.113.7`) on a dual-stack socket, but as plain IPv4
 * (`203.0.113.7`) behind a proxy. PostgreSQL `inet` treats those as different
 * values, so the same client would fail to match across direct-socket and proxy
 * paths. Collapsing the mapped form to plain IPv4 keeps comparisons consistent.
 * Pure IPv6 addresses (including `::1`) are returned unchanged.
 *
 * @param {string|null|undefined} ip
 * @returns {string|null}
 */
export function normalizeIpAddress(ip) {
  if (ip == null) return null;
  const trimmed = String(ip).trim();
  if (trimmed === '') return null;

  const mapped = IPV4_MAPPED_IPV6.exec(trimmed);
  if (mapped) return mapped[1];

  return trimmed;
}
