/**
 * AuditLogModel
 * Đại diện cho bảng 'audit_logs' trong cơ sở dữ liệu.
 */
export class AuditLogModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.actor_id = data.actor_id || null;
    this.actor_role = data.actor_role || null;
    this.action = data.action || null;
    this.entity_type = data.entity_type || null;
    this.entity_id = data.entity_id || null;
    this.previous_status = data.previous_status || null;
    this.new_status = data.new_status || null;
    this.reason = data.reason || null;
    this.metadata = data.metadata || null; // JSONB
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}
