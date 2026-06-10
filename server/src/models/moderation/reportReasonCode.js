/**
 * ReportReasonCodeModel
 * Represents the 'report_reason_codes' seed table.
 */
export class ReportReasonCodeModel {
  constructor(data = {}) {
    this.code = data.code ?? null;
    this.label = data.label ?? null;
    this.entity_type = data.entity_type ?? null; // 'REVIEW' | 'USER' | 'RESTAURANT'
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}

