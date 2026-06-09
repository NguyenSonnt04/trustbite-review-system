/**
 * FraudFlagEntityModel
 * Đại diện cho bảng 'fraud_flag_entities' (junction table N-N) trong cơ sở dữ liệu.
 */
export class FraudFlagEntityModel {
  constructor(data = {}) {
    this.fraud_flag_id = data.fraud_flag_id || null;
    this.entity_type = data.entity_type || null; // 'USER' | 'REVIEW' | 'RECEIPT_VERIFICATION'
    this.entity_id = data.entity_id || null;
  }
}
