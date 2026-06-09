/**
 * RestaurantClaimModel
 * Đại diện cho bảng 'restaurant_claims' trong cơ sở dữ liệu.
 */
export class RestaurantClaimModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.merchant_id = data.merchant_id || null;
    this.restaurant_id = data.restaurant_id || null;
    this.status = data.status || 'SUBMITTED'; // 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
    this.evidence_url = data.evidence_url || null; // S3 link chứng từ
    this.admin_note = data.admin_note || null;
    this.decided_by = data.decided_by || null;
    this.decided_at = data.decided_at ? new Date(data.decided_at) : null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
