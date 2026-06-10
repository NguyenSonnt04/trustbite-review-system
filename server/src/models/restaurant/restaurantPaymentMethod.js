/**
 * RestaurantPaymentMethodModel
 * Represents the 'restaurant_payment_methods' junction table.
 */
export class RestaurantPaymentMethodModel {
  constructor(data = {}) {
    this.restaurant_id = data.restaurant_id ?? null;
    this.payment_method_id = data.payment_method_id != null ? parseInt(data.payment_method_id, 10) : null;
  }
}

