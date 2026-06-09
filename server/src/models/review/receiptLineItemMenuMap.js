/**
 * ReceiptLineItemMenuMapModel
 * Đại diện cho bảng 'receipt_line_item_menu_maps' (junction table N-N) trong cơ sở dữ liệu.
 */
export class ReceiptLineItemMenuMapModel {
  constructor(data = {}) {
    this.receipt_line_item_id = data.receipt_line_item_id || null;
    this.menu_item_id = data.menu_item_id || null;
    this.confidence_score = data.confidence_score != null ? parseFloat(data.confidence_score) : null; // Điểm tin cậy map món (%)
  }
}
