/**
 * UserBlockModel
 * Đại diện cho bảng 'user_blocks' trong cơ sở dữ liệu.
 */
export class UserBlockModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.blocker_user_id = data.blocker_user_id || null;
    this.blocked_user_id = data.blocked_user_id || null;
    this.reason_code = data.reason_code || null;
    this.source_review_id = data.source_review_id || null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.deleted_at = data.deleted_at ? new Date(data.deleted_at) : null; // soft delete phục vụ bỏ chặn
  }
}
