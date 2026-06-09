/**
 * PaymentMethodModel
 * Represents the 'payment_methods' seed table.
 */
export class PaymentMethodModel {
  constructor(data = {}) {
    this.id = data.id != null ? parseInt(data.id, 10) : null;
    this.code = data.code ?? null;
    this.label = data.label ?? null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}

