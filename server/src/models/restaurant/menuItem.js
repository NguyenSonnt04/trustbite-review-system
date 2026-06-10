/**
 * MenuItemModel
 * Đại diện cho bảng 'menu_items' (món ăn của hệ thống chuỗi) trong cơ sở dữ liệu.
 */
export class MenuItemModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.restaurant_id = data.restaurant_id || null;
    this.name = data.name || null;
    this.price_default = data.price_default != null ? parseFloat(data.price_default) : null;
    this.currency = data.currency || 'VND';
    this.status = data.status || 'ACTIVE'; // 'ACTIVE' | 'ARCHIVED'
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
