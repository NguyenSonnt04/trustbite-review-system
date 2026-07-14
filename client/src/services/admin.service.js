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

export const adminCapabilities = Object.freeze({
  users: {
    state: 'blocked',
    detail: 'Server chưa có API danh sách và chi tiết người dùng dành cho quản trị viên.',
  },
  restaurants: {
    state: 'read-only',
    detail: 'Danh sách công khai đã kết nối. Thao tác thay đổi dữ liệu bị khóa cho đến khi có chính sách phân quyền.',
  },
  reviews: {
    state: 'blocked',
    detail: 'Server chưa có API kiểm duyệt hoặc quản lý đánh giá dành cho quản trị viên.',
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
};
