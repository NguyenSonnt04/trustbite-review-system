/**
 * ReviewModel
 * Đại diện cho bảng 'reviews' trong cơ sở dữ liệu.
 */
export class ReviewModel {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.user_id = data.user_id ?? null;
    this.restaurant_id = data.restaurant_id ?? null;
    this.branch_id = data.branch_id ?? null; // Chi nhánh cụ thể user đến ăn
    this.food_rating = data.food_rating != null ? parseInt(data.food_rating, 10) : null;
    this.price_rating = data.price_rating != null ? parseInt(data.price_rating, 10) : null;
    this.service_rating = data.service_rating != null ? parseInt(data.service_rating, 10) : null;
    this.ambience_rating = data.ambience_rating != null ? parseInt(data.ambience_rating, 10) : null;
    this.average_rating = data.average_rating != null ? parseFloat(data.average_rating) : null;
    this.comment = data.comment ?? null;
    this.status = data.status ?? 'DRAFT'; // 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REFERENCE_ONLY' | 'PENDING_ADMIN_REVIEW' | 'REJECTED' | 'HIDDEN' | 'DELETED'
    this.verification_status = data.verification_status ?? 'UNVERIFIED'; // 'UNVERIFIED' | 'PROCESSING' | 'SKIPPED' | 'EXPIRED_NO_RECEIPT' | 'VERIFIED' | 'PENDING_ADMIN_REVIEW' | 'REFERENCE_ONLY' | 'REJECTED' | 'DUPLICATE_REJECTED' | 'RECEIPT_REJECTED_REFERENCE_ALLOWED' | 'DELETED'
    this.trust_label = data.trust_label ?? 'PENDING_VERIFICATION'; // 'PENDING_VERIFICATION' | 'PROCESSING' | 'VERIFIED' | 'PENDING_ADMIN_REVIEW' | 'REFERENCE_ONLY' | 'REJECTED' | 'HIDDEN' | 'DELETED'
    this.public_visibility = data.public_visibility ?? 'PRIVATE_UNTIL_DECISION'; // 'PUBLIC' | 'PRIVATE' | 'PRIVATE_UNTIL_DECISION'
    this.trust_weight_bucket = data.trust_weight_bucket ?? 'NONE'; // 'HIGH' | 'LOW' | 'NONE'
    this.visited_at = data.visited_at ? new Date(data.visited_at) : null;
    this.hidden_reason = data.hidden_reason ?? null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
