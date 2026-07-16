import { createHttpError } from '../utils/httpErrors.js';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);
const MANAGER_PERMISSIONS = new Set(['OWNER', 'MANAGER']);

const normalizeRoles = (roles = []) => (
  new Set(roles.map((role) => String(role).trim().toUpperCase()).filter(Boolean))
);

export async function authorizeRestaurantMedia(client, {
  userId,
  roles,
  restaurantId,
}) {
  const roleSet = normalizeRoles(roles);
  const platformRole = [...ADMIN_ROLES].find((role) => roleSet.has(role));
  if (platformRole) {
    return {
      actorRole: platformRole,
      source: 'PLATFORM_ADMIN',
    };
  }

  if (!roleSet.has('MERCHANT')) {
    throw createHttpError(403, 'FORBIDDEN', 'Restaurant media management permission is required.');
  }

  const assignmentResult = await client.query(
    `SELECT
       m.id AS merchant_id,
       rm.permission_level
     FROM merchants m
     JOIN restaurant_merchants rm ON rm.merchant_id = m.id
     WHERE m.user_id = $1
       AND m.status = 'ACTIVE'
       AND rm.restaurant_id = $2
       AND rm.status = 'ACTIVE'
       AND rm.permission_level IN ('OWNER', 'MANAGER')
     LIMIT 1`,
    [userId, restaurantId],
  );

  if (assignmentResult.rowCount === 0) {
    throw createHttpError(403, 'FORBIDDEN', 'Restaurant media management permission is required.');
  }

  const assignment = assignmentResult.rows[0];
  if (!MANAGER_PERMISSIONS.has(assignment.permission_level)) {
    throw createHttpError(403, 'FORBIDDEN', 'Restaurant media management permission is required.');
  }

  return {
    actorRole: `MERCHANT_${assignment.permission_level}`,
    merchantId: assignment.merchant_id,
    permissionLevel: assignment.permission_level,
    source: 'RESTAURANT_ASSIGNMENT',
  };
}
