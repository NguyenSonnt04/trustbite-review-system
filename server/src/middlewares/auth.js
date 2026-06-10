// TODO: Implement Authorization middleware to validate JWT tokens / Cognito sessions.
// Current placeholder intentionally passes through so routes can be wired before
// the auth story provides token validation.
export const authMiddleware = (req, res, next) => {
  next();
};
