/**
 * ExpTransactionModel
 * Đại diện cho bảng 'exp_transactions' trong cơ sở dữ liệu.
 */
export class ExpTransactionModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.user_id = data.user_id || null;
    this.delta = data.delta != null ? parseInt(data.delta, 10) : 0; // EXP cộng (dương) hoặc trừ (âm)
    this.reason = data.reason || null; // e.g., 'REVIEW_SUBMITTED', 'RECEIPT_VERIFIED'
    this.entity_type = data.entity_type || null; // 'REVIEW' | 'RECEIPT'
    this.entity_id = data.entity_id || null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}
