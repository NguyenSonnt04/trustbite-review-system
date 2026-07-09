const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'require']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'disable']);

function normalize(value) {
  return value?.trim().toLowerCase();
}

function isFalse(value) {
  return FALSE_VALUES.has(normalize(value));
}

function isTrue(value) {
  return TRUE_VALUES.has(normalize(value));
}

export function getDatabaseSslConfig(env = process.env) {
  if (env.DATABASE_SSL !== undefined && env.DATABASE_SSL !== '') {
    if (isFalse(env.DATABASE_SSL)) return false;
    if (isTrue(env.DATABASE_SSL)) {
      return {
        rejectUnauthorized: !isFalse(env.DATABASE_SSL_REJECT_UNAUTHORIZED),
      };
    }
  }

  const sslMode = normalize(env.PGSSLMODE);
  if (!sslMode || sslMode === 'prefer' || sslMode === 'allow') return false;
  if (sslMode === 'disable') return false;
  if (sslMode === 'no-verify') return { rejectUnauthorized: false };

  return {
    rejectUnauthorized: !isFalse(env.DATABASE_SSL_REJECT_UNAUTHORIZED),
  };
}
