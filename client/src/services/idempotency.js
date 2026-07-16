export const createIdempotencyKey = () => {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('A secure browser UUID generator is required.');
  }
  return crypto.randomUUID();
};
