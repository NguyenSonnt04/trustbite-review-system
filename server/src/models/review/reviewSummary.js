/**
 * ReviewSummaryModel
 * Đại diện cho bảng 'review_summaries' (tóm tắt AI) trong cơ sở dữ liệu.
 */
export class ReviewSummaryModel {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.restaurant_id = data.restaurant_id ?? null;
    this.summary_text = data.summary_text ?? null;
    this.model_version = data.model_version ?? null; // model ID của Bedrock
    this.generated_at = data.generated_at ? new Date(data.generated_at) : null;
    this.review_count = data.review_count != null ? parseInt(data.review_count, 10) : 0;
    this.avg_rating = data.avg_rating != null ? parseFloat(data.avg_rating) : null;
  }
}
