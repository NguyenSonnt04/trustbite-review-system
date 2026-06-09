/**
 * UserSavedListModel
 * Đại diện cho bảng 'user_saved_lists' (bộ sưu tập quán ăn) trong cơ sở dữ liệu.
 */
export class UserSavedListModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.user_id = data.user_id || null;
    this.name = data.name || null;
    this.description = data.description || null;
    this.is_public = data.is_public != null ? Boolean(data.is_public) : false;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
