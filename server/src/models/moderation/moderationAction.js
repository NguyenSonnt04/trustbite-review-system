/**
 * ModerationActionModel
 * Đại diện cho bảng 'moderation_actions' trong cơ sở dữ liệu.
 */
export class ModerationActionModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.report_id = data.report_id || null;
    this.admin_id = data.admin_id || null;
    this.action_type = data.action_type || null; // e.g. 'HIDE_REVIEW', 'SUSPEND_USER'
    this.entity_type = data.entity_type || null;
    this.entity_id = data.entity_id || null;
    this.reason = data.reason || null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}
