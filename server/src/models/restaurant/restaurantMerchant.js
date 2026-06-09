/**
 * RestaurantMerchantModel
 * Đại diện cho bảng 'restaurant_merchants' (junction table N-N) trong cơ sở dữ liệu.
 */
export class RestaurantMerchantModel {
  constructor(data = {}) {
    this.restaurant_id = data.restaurant_id || null;
    this.merchant_id = data.merchant_id || null;
    this.permission_level = data.permission_level || 'OWNER'; // 'OWNER' | 'MANAGER' | 'STAFF'
    this.status = data.status || 'ACTIVE'; // 'ACTIVE' | 'INACTIVE'
    this.assigned_at = data.assigned_at ? new Date(data.assigned_at) : null;
  }
}
