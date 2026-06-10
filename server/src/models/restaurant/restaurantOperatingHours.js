/**
 * RestaurantOperatingHoursModel
 * Đại diện cho bảng 'restaurant_operating_hours' trong cơ sở dữ liệu.
 */
export class RestaurantOperatingHoursModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.branch_id = data.branch_id || null;
    this.day_of_week = data.day_of_week !== undefined ? parseInt(data.day_of_week) : null; // 0: Chủ Nhật -> 6: Thứ Bảy
    this.open_time = data.open_time || null; // e.g., '08:00:00'
    this.close_time = data.close_time || null; // e.g., '22:00:00'
    this.is_closed = data.is_closed !== undefined ? data.is_closed : false;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
