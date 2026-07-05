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
    this.ocr_text = data.ocr_text ?? null; // Raw OCR text; excluded from toJSON because it may contain PII
    this.ocr_restaurant_name = data.ocr_restaurant_name ?? null;
    this.ocr_similarity = data.ocr_similarity != null ? parseFloat(data.ocr_similarity) : null;
    this.ocr_receipt_time = data.ocr_receipt_time ? new Date(data.ocr_receipt_time) : null;
    this.ocr_invoice_no = data.ocr_invoice_no ?? null;
    this.ocr_total_amount = data.ocr_total_amount != null ? parseFloat(data.ocr_total_amount) : null;
    this.gps_latitude = data.gps_latitude != null ? parseFloat(data.gps_latitude) : null;
    this.gps_longitude = data.gps_longitude != null ? parseFloat(data.gps_longitude) : null;
    this.gps_accuracy_meters = data.gps_accuracy_meters != null ? parseFloat(data.gps_accuracy_meters) : null;
    this.gps_distance_meters = data.gps_distance_meters != null ? parseFloat(data.gps_distance_meters) : null;
    this.captured_at = data.captured_at ? new Date(data.captured_at) : null;
    this.fraud_risk_score = data.fraud_risk_score != null ? parseInt(data.fraud_risk_score, 10) : 0;
    this.decision = data.decision ?? null; // 'VERIFIED' | 'REJECTED' | 'REFERENCE_ONLY'
    this.redacted_file_url = data.redacted_file_url ?? null; // S3 path ẩn thông tin PII
    this.decision_reason = data.decision_reason ?? null;
    this.decided_by = data.decided_by ?? null;
    this.decided_at = data.decided_at ? new Date(data.decided_at) : null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
    this.updated_at = data.updated_at ? new Date(data.updated_at) : null;
  }

  toJSON() {
    return {
      id: this.id,
      review_id: this.review_id,
      user_id: this.user_id,
      restaurant_id: this.restaurant_id,
      branch_id: this.branch_id,
      file_url: this.file_url,
      file_hash_sha256: this.file_hash_sha256,
      transaction_unique_hash: this.transaction_unique_hash,
      status: this.status,
      ocr_restaurant_name: this.ocr_restaurant_name,
      ocr_similarity: this.ocr_similarity,
      ocr_receipt_time: this.ocr_receipt_time,
      ocr_invoice_no: this.ocr_invoice_no,
      ocr_total_amount: this.ocr_total_amount,
      gps_latitude: this.gps_latitude,
      gps_longitude: this.gps_longitude,
      gps_accuracy_meters: this.gps_accuracy_meters,
      gps_distance_meters: this.gps_distance_meters,
      captured_at: this.captured_at,
      fraud_risk_score: this.fraud_risk_score,
      decision: this.decision,
      redacted_file_url: this.redacted_file_url,
      decision_reason: this.decision_reason,
      decided_by: this.decided_by,
      decided_at: this.decided_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
