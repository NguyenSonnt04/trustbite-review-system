/**
 * AdminQueueAssignmentModel
 * Đại diện cho bảng 'admin_queue_assignments' (junction table N-N) trong cơ sở dữ liệu.
 */
export class AdminQueueAssignmentModel {
  constructor(data = {}) {
    this.queue_id = data.queue_id || null;
    this.admin_user_id = data.admin_user_id || null;
    this.assigned_at = data.assigned_at ? new Date(data.assigned_at) : null;
    this.resolved_at = data.resolved_at ? new Date(data.resolved_at) : null;
  }
}
