/**
 * UserBadgeModel
 * Đại diện cho bảng 'user_badges' (junction table N-N) trong cơ sở dữ liệu.
 */
export class UserBadgeModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.user_id = data.user_id || null;
    this.badge_code = data.badge_code || null; // FK -> badge_definitions.code
    this.awarded_at = data.awarded_at ? new Date(data.awarded_at) : null;
  }
}
