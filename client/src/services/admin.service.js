import config from '@/config/config';
const normalizeRootUrl = (url) => url.replace(/\/+$/u, '');
const normalizeApiUrl = (url) => {
  const rootUrl = normalizeRootUrl(url);
  return rootUrl.endsWith('/api/v1') ? rootUrl : `${rootUrl}/api/v1`;
};
const ADMIN_SESSION_ERROR_CODES = new Set([
  'ADMIN_SESSION_INVALID',
  'ADMIN_SESSION_EXPIRED',
  'ADMIN_ACCESS_REQUIRED',
  'ACCOUNT_SUSPENDED',
]);
const RESTAURANT_ACTOR_SESSION_ERROR_CODES = new Set([
  'DELETION_REQUEST_ACTIVE',
  'ACCOUNT_DELETED',
]);

const readHealth = async () => {
  const response = await fetch(`${normalizeRootUrl(config.apiUrl)}/health`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json();
};

const requestAdminResource = async (basePath, path = '', {
  method = 'GET',
  body,
  idempotencyKey,
} = {}) => {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = {};
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`/api/admin/${basePath}${path}`, {
    method,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    cache: 'no-store',
  });
  const responseBody = response.status === 204
    ? null
    : await response.json().catch(() => null);
  if (!response.ok) {
    if (
      (
        ADMIN_SESSION_ERROR_CODES.has(responseBody?.error?.code)
        || (
          basePath === 'restaurants'
          && RESTAURANT_ACTOR_SESSION_ERROR_CODES.has(responseBody?.error?.code)
        )
      )
      && typeof window !== 'undefined'
    ) {
      window.location.replace('/?reason=session_expired');
    }
    const error = new Error(responseBody?.error?.message || 'Không thể xử lý yêu cầu quản trị.');
    error.code = responseBody?.error?.code || 'ADMIN_REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  return responseBody;
};

const listRestaurants = ({
  keyword = '',
  status = '',
  page = 1,
  pageSize = 20,
} = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (keyword.trim()) {
    params.set('keyword', keyword.trim());
  }
  if (status) params.set('status', status);
  return requestAdminResource('restaurants', `?${params.toString()}`);
};

const listRestaurantReviews = async (restaurantId, {
  status = 'ALL',
  page = 1,
  pageSize = 10,
} = {}) => {
  const params = new URLSearchParams({
    status,
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await fetch(
    `${normalizeApiUrl(config.apiUrl)}/restaurants/${encodeURIComponent(restaurantId)}/reviews?${params.toString()}`,
    { cache: 'no-store' },
  );
  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(responseBody?.error?.message || 'Không thể tải đánh giá của nhà hàng.');
    error.code = responseBody?.error?.code || 'RESTAURANT_REVIEWS_REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  return responseBody;
};

const requestAdminUsers = async (path = '', { method = 'GET', body } = {}) => {
  const response = await fetch(`/api/admin/users${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const responseBody = response.status === 204
    ? null
    : await response.json().catch(() => null);
  if (!response.ok) {
    if (
      ADMIN_SESSION_ERROR_CODES.has(responseBody?.error?.code)
      && typeof window !== 'undefined'
    ) {
      window.location.replace('/?reason=session_expired');
    }
    const error = new Error(responseBody?.error?.message || 'Không thể xử lý yêu cầu quản lý người dùng.');
    error.code = responseBody?.error?.code || 'ADMIN_USER_REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  return responseBody;
};

const listUsers = ({
  page = 1,
  pageSize = 20,
  keyword = '',
  status = '',
  role = '',
} = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (keyword.trim()) params.set('keyword', keyword.trim());
  if (status) params.set('status', status);
  if (role) params.set('role', role);
  return requestAdminUsers(`?${params.toString()}`);
};

const getUser = (userId) => requestAdminUsers(`/${userId}`);
const createUser = (body) => requestAdminUsers('', { method: 'POST', body });
const updateUser = (userId, body) => requestAdminUsers(`/${userId}`, { method: 'PATCH', body });
const suspendUser = (userId, reason) => requestAdminUsers(`/${userId}/suspend`, {
  method: 'POST',
  body: { reason },
});
const reactivateUser = (userId, reason) => requestAdminUsers(`/${userId}/reactivate`, {
  method: 'POST',
  body: { reason },
});
const getRestaurant = (restaurantId) => requestAdminResource('restaurants', `/${restaurantId}`);
const updateRestaurant = (restaurantId, body) => requestAdminResource(
  'restaurants',
  `/${restaurantId}`,
  { method: 'PATCH', body },
);
const deleteRestaurants = (
  body,
  idempotencyKey = crypto.randomUUID(),
) => requestAdminResource(
  'restaurants',
  '/bulk-delete',
  { method: 'POST', body, idempotencyKey },
);
const uploadRestaurantImage = (
  restaurantId,
  formData,
  idempotencyKey = crypto.randomUUID(),
) => requestAdminResource(
  'restaurants',
  `/${restaurantId}/images`,
  { method: 'POST', body: formData, idempotencyKey },
);
const updateRestaurantImage = (restaurantId, imageId, body) => requestAdminResource(
  'restaurants',
  `/${restaurantId}/images/${imageId}`,
  { method: 'PATCH', body },
);
const replaceRestaurantImage = (
  restaurantId,
  imageId,
  formData,
  idempotencyKey = crypto.randomUUID(),
) => requestAdminResource(
  'restaurants',
  `/${restaurantId}/images/${imageId}/replace`,
  { method: 'POST', body: formData, idempotencyKey },
);
const deleteRestaurantImage = (
  restaurantId,
  imageId,
  idempotencyKey = crypto.randomUUID(),
) => requestAdminResource(
  'restaurants',
  `/${restaurantId}/images/${imageId}`,
  { method: 'DELETE', idempotencyKey },
);

export const adminCapabilities = Object.freeze({
  users: {
    state: 'partial',
    detail: 'Danh sách, hồ sơ, tạo mới, vai trò và trạng thái được bảo vệ qua BFF quản trị.',
  },
  restaurants: {
    state: 'partial',
    detail: 'Danh sách, hồ sơ, trạng thái và thư viện ảnh được bảo vệ qua BFF quản trị.',
  },
  reviews: {
    state: 'read-only',
    detail: 'Có thể đọc đánh giá công khai theo nhà hàng; thao tác kiểm duyệt vẫn chờ API quản trị.',
  },
  verifications: {
    state: 'blocked',
    detail: 'Server chưa có API hàng đợi xác minh biên nhận dành cho quản trị viên.',
  },
  audit: {
    state: 'blocked',
    detail: 'Server chưa có API đọc nhật ký quản trị.',
  },
  monitoring: {
    state: 'partial',
    detail: 'Chỉ có trạng thái tiến trình. Cơ sở dữ liệu, hàng đợi và nhà cung cấp chưa có điểm kiểm tra công khai.',
  },
});

export const adminService = {
  readHealth,
  listRestaurants,
  listRestaurantReviews,
  getRestaurant,
  updateRestaurant,
  deleteRestaurants,
  uploadRestaurantImage,
  updateRestaurantImage,
  replaceRestaurantImage,
  deleteRestaurantImage,
  listUsers,
  getUser,
  createUser,
  updateUser,
  suspendUser,
  reactivateUser,
};
