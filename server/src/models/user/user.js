/**
 * UserModel
 * Đại diện cho bảng 'users' trong cơ sở dữ liệu.
 */
export class UserModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.phone_number = data.phone_number || null;
    this.display_name = data.display_name || null;
    this.avatar_url = data.avatar_url || null;
    this.status = data.status || 'ACTIVE'; // 'ACTIVE' | 'SUSPENDED' | 'DELETED'
    this.exp_points = data.exp_points || 0;
    this.rank_code = data.rank_code || 'NEWBIE';
    this.review_restricted_until = data.review_restricted_until ? new Date(data.review_restricted_until) : null;
    this.deletion_requested_at = data.deletion_requested_at ? new Date(data.deletion_requested_at) : null;
    this.deleted_at = data.deleted_at ? new Date(data.deleted_at) : null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
