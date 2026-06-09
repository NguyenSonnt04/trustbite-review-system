/**
 * FraudFlagModel
 * Đại diện cho bảng 'fraud_flags' trong cơ sở dữ liệu.
 */
export class FraudFlagModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.flag_code = data.flag_code || null; // e.g., 'GPS_MISMATCH', 'DUPLICATE_RECEIPT'
    this.risk_score = data.risk_score || 0; // 0 -> 100
    this.status = data.status || 'OPEN'; // 'OPEN' | 'RESOLVED' | 'DISMISSED'
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.resolved_at = data.resolved_at ? new Date(data.resolved_at) : null;
  }
}
