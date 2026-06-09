/**
 * ReviewTagModel
 * Đại diện cho bảng 'review_tags' (junction table N-N) trong cơ sở dữ liệu.
 */
export class ReviewTagModel {
  constructor(data = {}) {
    this.review_id = data.review_id || null;
    this.tag_id = data.tag_id || null; // FK -> tags.id
  }
}
