/**
 * UserSessionModel
 * Đại diện cho bảng 'user_sessions' trong cơ sở dữ liệu.
 */
export class UserSessionModel {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.user_id = data.user_id ?? null;
    this.refresh_token_hash = data.refresh_token_hash ?? null;
    this.device_label = data.device_label ?? null;
    this.platform = data.platform ?? null; // 'ANDROID' | 'IOS' | 'WEB'
    this.revoked_at = data.revoked_at ? new Date(data.revoked_at) : null;
    this.expires_at = data.expires_at ? new Date(data.expires_at) : null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
