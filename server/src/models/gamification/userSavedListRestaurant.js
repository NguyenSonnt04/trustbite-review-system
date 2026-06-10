/**
 * UserSavedListRestaurantModel
 * Đại diện cho bảng 'user_saved_list_restaurants' (junction table N-N) trong cơ sở dữ liệu.
 */
export class UserSavedListRestaurantModel {
  constructor(data = {}) {
    this.saved_list_id = data.saved_list_id || null;
    this.restaurant_id = data.restaurant_id || null;
    this.added_at = data.added_at ? new Date(data.added_at) : null;
  }
}
