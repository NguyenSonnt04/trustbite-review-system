/**
 * RestaurantAmenityModel
 * Represents the 'restaurant_amenities' junction table.
 */
export class RestaurantAmenityModel {
  constructor(data = {}) {
    this.restaurant_id = data.restaurant_id ?? null;
    this.amenity_id = data.amenity_id != null ? parseInt(data.amenity_id, 10) : null;
  }
}

