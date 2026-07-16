import { api } from './api';
import { createIdempotencyKey } from './idempotency';

const listAssignedRestaurants = () => (
  api.get('/merchant/restaurants', { cache: 'no-store' })
);

const listClaims = () => (
  api.get('/merchant/restaurant-claims', { cache: 'no-store' })
);

const listPublicRestaurants = ({ keyword = '', pageSize = 50 } = {}) => {
  const params = new URLSearchParams({
    page: '1',
    pageSize: String(pageSize),
    sort: 'name',
  });
  if (keyword.trim()) params.set('keyword', keyword.trim());
  return api.get(`/restaurants?${params.toString()}`);
};

const submitClaim = ({
  restaurantId,
  requestedPermissionLevel,
  evidenceFile,
  idempotencyKey = createIdempotencyKey(),
}) => {
  const body = new FormData();
  body.append('restaurantId', restaurantId);
  body.append('requestedPermissionLevel', requestedPermissionLevel);
  body.append('evidenceFile', evidenceFile);
  return api.post('/merchant/restaurant-claims', body, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
};

export const merchantService = {
  listAssignedRestaurants,
  listClaims,
  listPublicRestaurants,
  submitClaim,
};
