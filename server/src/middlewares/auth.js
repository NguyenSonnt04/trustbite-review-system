import { authService } from '../services/auth.js';
import { pool } from '../config/db.js';
import { createHttpError } from '../utils/httpErrors.js';

const ACTIVE_DELETION_STATUSES = ['REQUESTED', 'PROCESSING'];

const normalizeRole = (role) => (role == null ? '' : String(role).trim().toUpperCase());
const normalizeRoleList = (roles = []) => [...new Set(roles.map(normalizeRole).filter(Boolean))];

const getOriginalPathname = (req) => {
  try {
    return new URL(req.originalUrl || req.url || '/', 'http://trustbite.local').pathname;
  } catch {
    return req.path || '';
  }
};

const normalizePathname = (pathname) => {
  if (!pathname || pathname === '/') {
    return pathname || '';
  }

  return pathname.replace(/\/+$/, '');
};

const isDeletionLifecycleRoute = (req) => {
  const method = req.method.toUpperCase();
  const pathname = normalizePathname(getOriginalPathname(req));

  if (pathname === '/api/v1/users/me/deletion-request') {
    return method === 'GET' || method === 'POST';
  }

  return pathname === '/api/v1/users/me/deletion-request/cancel' && method === 'POST';
};

const getActiveDeletionRequest = async (userId) => {
  const result = await pool.query(
    `SELECT id, status
       FROM account_deletion_requests
      WHERE user_id = $1
        AND status = ANY($2::varchar[])
      ORDER BY requested_at DESC
      LIMIT 1`,
    [userId, ACTIVE_DELETION_STATUSES],
  );

  return result.rows[0] ?? null;
};

const enforceAuthenticatedAccountState = async (req) => {
  const activeDeletionRequest = await getActiveDeletionRequest(req.user.id);

  if (activeDeletionRequest) {
    if (isDeletionLifecycleRoute(req)) {
      return;
    }

    throw createHttpError(409, 'DELETION_REQUEST_ACTIVE', 'Account deletion request is active');
  }

  if (req.user.status === 'SUSPENDED') {
    throw createHttpError(403, 'ACCOUNT_SUSPENDED', 'Account is suspended');
  }

  if (req.user.status === 'DELETED') {
    throw createHttpError(403, 'ACCOUNT_DELETED', 'Account is deleted');
  }
};

export const authMiddleware = async (req, res, next) => {
  try {
    req.user = await authService.authenticateRequest(req, { enforceStatus: false });
    await enforceAuthenticatedAccountState(req);
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
