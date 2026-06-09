/**
 * PriceHistoryModel
 * Đại diện cho bảng 'price_history' trong cơ sở dữ liệu.
 */
export class PriceHistoryModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.menu_item_id = data.menu_item_id || null;
    this.branch_id = data.branch_id || null; // Null nếu đổi giá chung cho cả thương hiệu
    this.observed_price = data.observed_price != null ? parseFloat(data.observed_price) : null;
    this.currency = data.currency || 'VND';
    this.source = data.source || null; // 'OCR_RECEIPT' | 'MERCHANT_UPDATE' | 'MANUAL'
    this.review_id = data.review_id || null;
    this.observed_at = data.observed_at ? new Date(data.observed_at) : null;
  }
}
