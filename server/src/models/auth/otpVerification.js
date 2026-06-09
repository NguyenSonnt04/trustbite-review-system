/**
 * OtpVerificationModel
 * Đại diện cho bảng 'otp_verifications' trong cơ sở dữ liệu.
 */
export class OtpVerificationModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.phone_number = data.phone_number || null;
    this.otp_hash = data.otp_hash || null;
    this.purpose = data.purpose || null; // FK -> otp_purposes.code ('LOGIN' | 'REGISTER'...)
    this.status = data.status || 'PENDING'; // 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'LOCKED'
    this.failed_attempts = data.failed_attempts || 0;
    this.expires_at = data.expires_at ? new Date(data.expires_at) : null;
    this.verified_at = data.verified_at ? new Date(data.verified_at) : null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}
