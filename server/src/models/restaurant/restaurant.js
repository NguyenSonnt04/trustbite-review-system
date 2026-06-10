/**
 * RestaurantModel
 * Đại diện cho bảng 'restaurants' (thông tin thương hiệu/chuỗi chính) trong cơ sở dữ liệu.
 */
export class RestaurantModel {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.name = data.name ?? null;
    this.slug = data.slug ?? null;
    this.description = data.description ?? null;
    this.phone_number = data.phone_number ?? null;
    this.address = data.address ?? null;
    this.latitude = data.latitude != null ? parseFloat(data.latitude) : null;
    this.longitude = data.longitude != null ? parseFloat(data.longitude) : null;
    this.geo = data.geo ?? null; // PostGIS Geography Point
    this.status = data.status ?? 'DRAFT'; // 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED'
    this.trust_score = data.trust_score != null ? parseFloat(data.trust_score) : 5.00;
    this.verified_review_count = data.verified_review_count != null ? parseInt(data.verified_review_count, 10) : 0;
    this.reference_review_count = data.reference_review_count != null ? parseInt(data.reference_review_count, 10) : 0;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
