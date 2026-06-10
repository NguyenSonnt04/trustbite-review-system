/**
 * ReviewVoteModel
 * Đại diện cho bảng 'review_votes' trong cơ sở dữ liệu.
 */
export class ReviewVoteModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.review_id = data.review_id || null;
    this.user_id = data.user_id || null;
    this.vote_type = data.vote_type || 'HELPFUL'; // 'HELPFUL' | 'NOT_HELPFUL'
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}
