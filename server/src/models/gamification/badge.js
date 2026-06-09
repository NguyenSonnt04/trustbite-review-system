/**
 * BadgeModel
 * Đại diện cho bảng 'badge_definitions' (cấu hình huy hiệu tĩnh) trong cơ sở dữ liệu.
 */
export class BadgeModel {
  constructor(data = {}) {
    this.code = data.code || null;
    this.label = data.label || null;
    this.description = data.description || null;
    this.icon_url = data.icon_url || null;
    this.category = data.category || null; // 'ACHIEVEMENT' | 'TRUST' | 'GAMIFICATION'
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}
