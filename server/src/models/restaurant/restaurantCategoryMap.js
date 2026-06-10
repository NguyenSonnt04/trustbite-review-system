/**
 * RestaurantCategoryMapModel
 * Represents the 'restaurant_category_map' junction table.
 */
export class RestaurantCategoryMapModel {
  constructor(data = {}) {
    this.restaurant_id = data.restaurant_id ?? null;
    this.category_id = data.category_id != null ? parseInt(data.category_id, 10) : null;
  }
}

