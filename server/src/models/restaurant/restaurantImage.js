/**
 * RestaurantImageModel
 * Đại diện cho bảng 'restaurant_images' trong cơ sở dữ liệu.
 */
export class RestaurantImageModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.restaurant_id = data.restaurant_id || null;
    this.branch_id = data.branch_id || null;
    this.image_url = data.image_url || null;
    this.caption = data.caption || null;
    this.is_primary = data.is_primary !== undefined ? data.is_primary : false;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}
