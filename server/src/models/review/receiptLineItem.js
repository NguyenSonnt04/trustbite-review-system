/**
 * ReceiptLineItemModel
 * Đại diện cho bảng 'receipt_line_items' trong cơ sở dữ liệu.
 */
export class ReceiptLineItemModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.receipt_verification_id = data.receipt_verification_id || null;
    this.raw_item_name = data.raw_item_name || null;
    this.quantity = data.quantity != null ? parseFloat(data.quantity) : 1.00;
    this.unit_price = data.unit_price != null ? parseFloat(data.unit_price) : null;
    this.total_price = data.total_price != null ? parseFloat(data.total_price) : null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}
