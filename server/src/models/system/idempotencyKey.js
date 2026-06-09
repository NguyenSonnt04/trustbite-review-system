/**
 * IdempotencyKeyModel
 * Đại diện cho bảng 'idempotency_keys' trong cơ sở dữ liệu.
 */
export class IdempotencyKeyModel {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.idempotency_key = data.idempotency_key ?? null;
    this.user_id = data.user_id ?? null;
    this.endpoint = data.endpoint ?? null; // e.g. 'POST /receipts'
    this.request_hash = data.request_hash ?? null;
    this.status = data.status ?? 'IN_PROGRESS'; // 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
    this.response_status_code = data.response_status_code != null ? parseInt(data.response_status_code, 10) : null;
    this.response_body = data.response_body ?? null; // JSONB
    this.resource_type = data.resource_type ?? null;
    this.resource_id = data.resource_id ?? null;
    this.locked_until = data.locked_until ? new Date(data.locked_until) : null;
    this.expires_at = data.expires_at ? new Date(data.expires_at) : null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
