const int = (name, fallback) => {
  const raw = process.env[name];
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const BOOL_TRUE = new Set(['1', 'true', 'yes', 'on']);

const bool = (name, fallback = false) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  return BOOL_TRUE.has(raw.trim().toLowerCase());
};

export function getRedisConnection() {
  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: int('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: int('REDIS_DB', 0),
    maxRetriesPerRequest: null,
  };

  if (bool('REDIS_TLS')) {
    connection.tls = {};
  }

  return connection;
}
