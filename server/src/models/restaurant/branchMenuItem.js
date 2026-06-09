/**
 * BranchMenuItemModel
 * Đại diện cho bảng 'branch_menu_items' (junction table N-N có payload) trong cơ sở dữ liệu.
 */
export class BranchMenuItemModel {
  constructor(data = {}) {
    this.branch_id = data.branch_id || null;
    this.menu_item_id = data.menu_item_id || null;
    this.price = data.price ? parseFloat(data.price) : null; // Giá thực tế tại chi nhánh này
    this.is_available = data.is_available !== undefined ? data.is_available : true;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
