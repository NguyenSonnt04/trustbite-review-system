import { authService } from '../services/auth.js';
import { createHttpError } from '../utils/httpErrors.js';

const normalizeRole = (role) => String(role).trim().toUpperCase();

export const authMiddleware = async (req, res, next) => {
  try {
    req.user = await authService.authenticateRequest(req);
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole = (...allowedRoles) => {
  const allowedRoleSet = new Set(allowedRoles.map(normalizeRole));

  return (req, res, next) => {
    const roles = req.user?.roles || [];
    const hasAllowedRole = roles.some((role) => allowedRoleSet.has(normalizeRole(role)));

    if (!hasAllowedRole) {
      next(createHttpError(403, 'FORBIDDEN', 'Required role is missing'));
      return;
    }

    next();
  };
};
