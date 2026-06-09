/**
 * NotificationModel
 * Đại diện cho bảng 'notifications' (thông báo người dùng) trong cơ sở dữ liệu.
 */
export class NotificationModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.recipient_user_id = data.recipient_user_id || null;
    this.type = data.type || null; // FK -> notification_types.code
    this.title = data.title || null;
    this.body = data.body || null;
    this.payload = data.payload || null; // JSONB chứa metadata điều hướng màn hình
    this.read_at = data.read_at ? new Date(data.read_at) : null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}
