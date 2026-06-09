/**
 * ReviewMediaModel
 * Đại diện cho bảng 'review_media' trong cơ sở dữ liệu.
 */
export class ReviewMediaModel {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.review_id = data.review_id ?? null;
    this.media_type = data.media_type ?? 'IMAGE'; // 'IMAGE' | 'VIDEO'
    this.url = data.url ?? null;
    this.mime_type = data.mime_type ?? null;
    this.file_size_bytes = data.file_size_bytes != null ? parseInt(data.file_size_bytes, 10) : null;
    this.status = data.status ?? 'ACTIVE'; // 'ACTIVE' | 'INACTIVE'
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}
