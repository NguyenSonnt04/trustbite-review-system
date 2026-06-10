/**
 * AccountDeletionRequestModel
 * Đại diện cho bảng 'account_deletion_requests' trong cơ sở dữ liệu.
 */
export class AccountDeletionRequestModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.user_id = data.user_id || null;
    this.status = data.status || 'REQUESTED'; // 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED'
    this.reason = data.reason || null;
    this.requested_at = data.requested_at ? new Date(data.requested_at) : null;
    this.scheduled_deletion_at = data.scheduled_deletion_at ? new Date(data.scheduled_deletion_at) : null;
    this.completed_at = data.completed_at ? new Date(data.completed_at) : null;
    this.cancelled_at = data.cancelled_at ? new Date(data.cancelled_at) : null;
    this.retained_data_reason = data.retained_data_reason || null;
    this.processed_by = data.processed_by || null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
