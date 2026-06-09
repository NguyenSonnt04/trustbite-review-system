/**
 * RestaurantBranchModel
 * Đại diện cho bảng 'restaurant_branches' trong cơ sở dữ liệu.
 */
export class RestaurantBranchModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.parent_restaurant_id = data.parent_restaurant_id || null;
    this.name = data.name || null;
    this.address = data.address || null;
    this.latitude = data.latitude ? parseFloat(data.latitude) : null;
    this.longitude = data.longitude ? parseFloat(data.longitude) : null;
    this.geo = data.geo || null; // PostGIS Geography Point
    this.status = data.status || 'ACTIVE'; // 'ACTIVE' | 'INACTIVE'
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
