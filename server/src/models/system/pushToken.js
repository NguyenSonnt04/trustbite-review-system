/**
 * PushTokenModel
 * Đại diện cho bảng 'push_tokens' trong cơ sở dữ liệu.
 */
export class PushTokenModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.user_id = data.user_id || null;
    this.platform = data.platform || null; // 'ANDROID' | 'IOS'
    this.token_ciphertext = data.token_ciphertext || null; // FCM/APNs token mã hóa AES-256
    this.token_fingerprint = data.token_fingerprint || null; // One-way hash để dedupe
    this.provider = data.provider || 'FCM'; // 'FCM' | 'APNS'
    this.status = data.status || 'ACTIVE'; // 'ACTIVE' | 'INACTIVE'
    this.last_seen_at = data.last_seen_at ? new Date(data.last_seen_at) : null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
