/**
 * MerchantModel
 * Đại diện cho bảng 'merchants' (hồ sơ chủ kinh doanh) trong cơ sở dữ liệu.
 */
export class MerchantModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.user_id = data.user_id || null; // FK -> users.id (UNIQUE)
    this.business_name = data.business_name || null;
    this.status = data.status || 'PENDING_VERIFICATION'; // 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED'
    this.verified_at = data.verified_at ? new Date(data.verified_at) : null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
