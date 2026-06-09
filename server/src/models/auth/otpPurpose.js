/**
 * OtpPurposeModel
 * Represents the 'otp_purposes' seed table.
 */
export class OtpPurposeModel {
  constructor(data = {}) {
    this.code = data.code ?? null;
    this.label = data.label ?? null;
    this.ttl_seconds = data.ttl_seconds != null ? parseInt(data.ttl_seconds, 10) : null;
    this.max_attempts = data.max_attempts != null ? parseInt(data.max_attempts, 10) : null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}

