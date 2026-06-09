/**
 * NotificationDeliveryLogModel
 * Đại diện cho bảng 'notification_delivery_logs' trong cơ sở dữ liệu.
 */
export class NotificationDeliveryLogModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.notification_id = data.notification_id || null;
    this.push_token_id = data.push_token_id || null;
    this.status = data.status || null; // 'SENT' | 'FAILED' | 'BOUNCED'
    this.error_message = data.error_message || null;
    this.sent_at = data.sent_at ? new Date(data.sent_at) : null;
  }
}
