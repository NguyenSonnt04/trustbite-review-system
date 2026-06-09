/**
 * ReviewReplyModel
 * Đại diện cho bảng 'review_replies' (phản hồi của Merchant) trong cơ sở dữ liệu.
 */
export class ReviewReplyModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.review_id = data.review_id || null;
    this.merchant_id = data.merchant_id || null;
    this.message = data.message || null;
    this.status = data.status || 'ACTIVE'; // 'ACTIVE' | 'HIDDEN'
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
