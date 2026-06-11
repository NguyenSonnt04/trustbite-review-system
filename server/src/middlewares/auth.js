import { authService } from '../services/auth.js';
import { createHttpError } from '../utils/httpErrors.js';

const normalizeRole = (role) => (role == null ? '' : String(role).trim().toUpperCase());
const normalizeRoleList = (roles = []) => [...new Set(roles.map(normalizeRole).filter(Boolean))];

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
    const roles = normalizeRoleList(req.user?.roles || []);
    const hasAllowedRole = roles.some((role) => allowedRoleSet.has(role));

    if (!hasAllowedRole) {
      next(createHttpError(403, 'FORBIDDEN', 'Required role is missing'));
      return;
    }

    next();
  };
};
