import config from '@/config/config';
import { api } from './api';

const normalizeRootUrl = (url) => url.replace(/\/+$/u, '');

const readHealth = async () => {
  const response = await fetch(`${normalizeRootUrl(config.apiUrl)}/health`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json();
};

const listRestaurants = ({ keyword = '', pageSize = 20 } = {}) => {
  const params = new URLSearchParams({
    page: '1',
    pageSize: String(pageSize),
    sort: 'trustScoreDesc',
  });

  if (keyword.trim()) {
    params.set('keyword', keyword.trim());
  }

  return api.get(`/restaurants?${params.toString()}`);
};

const getCurrentUser = () => api.get('/users/me', { cache: 'no-store' });

const listAdminRestaurants = ({ keyword = '', pageSize = 50 } = {}) => {
  const params = new URLSearchParams({
    page: '1',
    pageSize: String(pageSize),
  });
  if (keyword.trim()) params.set('keyword', keyword.trim());
  return api.get(`/admin/restaurants?${params.toString()}`, { cache: 'no-store' });
};

const listRestaurantClaims = (status = 'SUBMITTED') => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  return api.get(`/admin/restaurant-claims?${params.toString()}`, { cache: 'no-store' });
};

const decideRestaurantClaim = (claimId, decision, adminNote = '') => (
  api.post(`/admin/restaurant-claims/${claimId}/decision`, {
    decision,
    adminNote,
  })
);

export const adminCapabilities = Object.freeze({
  users: {
    state: 'blocked',
    detail: 'Server chưa có API danh sách và chi tiết người dùng dành cho quản trị viên.',
  },
  restaurants: {
    state: 'partial',
    detail: 'Quản trị viên có thể tải lên, xem và xóa ảnh nhà hàng. Chỉnh sửa hồ sơ tổng quát vẫn bị khóa.',
  },
  reviews: {
    state: 'blocked',
    detail: 'Server chưa có API kiểm duyệt hoặc quản lý đánh giá dành cho quản trị viên.',
  },
  verifications: {
    state: 'partial',
    detail: 'Hàng đợi bằng chứng quyền sở hữu nhà hàng đã kết nối. Xác minh biên nhận khách hàng vẫn tách biệt.',
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
  decideRestaurantClaim,
  getCurrentUser,
  listAdminRestaurants,
  listRestaurantClaims,
  readHealth,
  listRestaurants,
};
