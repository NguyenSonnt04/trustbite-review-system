/**
 * AdminQueueModel
 * Đại diện cho bảng 'admin_queues' trong cơ sở dữ liệu.
 */
export class AdminQueueModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.queue_type = data.queue_type || null; // 'CLAIM_VERIFICATION' | 'RECEIPT_AUDIT' | 'USER_REPORT'
    this.entity_id = data.entity_id || null;
    this.status = data.status || 'PENDING'; // 'PENDING' | 'ASSIGNED' | 'COMPLETED' | 'ESCALATED'
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
