/**
 * ModerationReportModel
 * Đại diện cho bảng 'moderation_reports' trong cơ sở dữ liệu.
 */
export class ModerationReportModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.reporter_id = data.reporter_id || null;
    this.entity_type = data.entity_type || null; // 'REVIEW' | 'USER' | 'RESTAURANT'
    this.entity_id = data.entity_id || null;
    this.reason_code = data.reason_code || null; // FK -> report_reason_codes.code
    this.description = data.description || null;
    this.status = data.status || 'SUBMITTED'; // 'SUBMITTED' | 'UNDER_REVIEW' | 'CLOSED' | 'ACTION_TAKEN'
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
