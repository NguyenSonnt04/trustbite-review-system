/**
 * ReviewModel
 * Đại diện cho bảng 'reviews' trong cơ sở dữ liệu.
 */
export class ReviewModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.user_id = data.user_id || null;
    this.restaurant_id = data.restaurant_id || null;
    this.branch_id = data.branch_id || null; // Chi nhánh cụ thể user đến ăn
    this.food_rating = data.food_rating || null;
    this.price_rating = data.price_rating || null;
    this.service_rating = data.service_rating || null;
    this.ambience_rating = data.ambience_rating || null;
    this.average_rating = data.average_rating ? parseFloat(data.average_rating) : null;
    this.comment = data.comment || null;
    this.status = data.status || 'DRAFT'; // 'DRAFT' | 'SUBMITTED' | 'REFERENCE_ONLY' | 'PUBLISHED' | 'HIDDEN' | 'DELETED'
    this.verification_status = data.verification_status || 'UNVERIFIED'; // 'UNVERIFIED' | 'PENDING_OCR' | 'VERIFIED' | 'REJECTED' | 'FLAGGED'
    this.trust_label = data.trust_label || 'PENDING_VERIFICATION'; // 'VERIFIED_REVIEW' | 'REFERENCE_REVIEW'
    this.public_visibility = data.public_visibility || 'PRIVATE_UNTIL_DECISION'; // 'PUBLIC' | 'PRIVATE_UNTIL_DECISION'
    this.trust_weight_bucket = data.trust_weight_bucket || 'NONE'; // 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'
    this.visited_at = data.visited_at ? new Date(data.visited_at) : null;
    this.hidden_reason = data.hidden_reason || null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
