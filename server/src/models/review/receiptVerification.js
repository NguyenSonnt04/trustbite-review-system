/**
 * ReceiptVerificationModel
 * Đại diện cho bảng 'receipt_verifications' trong cơ sở dữ liệu.
 */
export class ReceiptVerificationModel {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.review_id = data.review_id ?? null;
    this.user_id = data.user_id ?? null;
    this.restaurant_id = data.restaurant_id ?? null;
    this.branch_id = data.branch_id ?? null;
    this.file_url = data.file_url ?? null; // S3 path
    this.file_hash_sha256 = data.file_hash_sha256 ?? null;
    this.transaction_unique_hash = data.transaction_unique_hash ?? null;
    this.status = data.status ?? 'UPLOADED'; // 'UPLOADED' | 'HASH_CHECKING' | 'DUPLICATE_DETECTED' | 'OCR_PROCESSING' | 'OCR_SUCCESS' | 'OCR_FAILED' | 'VERIFIED' | 'PENDING_ADMIN_REVIEW' | 'REFERENCE_ONLY' | 'REJECTED'
    this.ocr_text = data.ocr_text ?? null; // Raw OCR text
    this.ocr_restaurant_name = data.ocr_restaurant_name ?? null;
    this.ocr_similarity = data.ocr_similarity != null ? parseFloat(data.ocr_similarity) : null;
    this.ocr_receipt_time = data.ocr_receipt_time ? new Date(data.ocr_receipt_time) : null;
    this.ocr_invoice_no = data.ocr_invoice_no ?? null;
    this.ocr_total_amount = data.ocr_total_amount != null ? parseFloat(data.ocr_total_amount) : null;
    this.gps_latitude = data.gps_latitude != null ? parseFloat(data.gps_latitude) : null;
    this.gps_longitude = data.gps_longitude != null ? parseFloat(data.gps_longitude) : null;
    this.gps_accuracy_meters = data.gps_accuracy_meters != null ? parseFloat(data.gps_accuracy_meters) : null;
    this.gps_distance_meters = data.gps_distance_meters != null ? parseFloat(data.gps_distance_meters) : null;
    this.fraud_risk_score = data.fraud_risk_score != null ? parseInt(data.fraud_risk_score, 10) : 0;
    this.decision = data.decision ?? null; // 'VERIFIED' | 'REJECTED' | 'REFERENCE_ONLY'
    this.redacted_file_url = data.redacted_file_url ?? null; // S3 path ẩn thông tin PII
    this.decision_reason = data.decision_reason ?? null;
    this.decided_by = data.decided_by ?? null;
    this.decided_at = data.decided_at ? new Date(data.decided_at) : null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }
}
