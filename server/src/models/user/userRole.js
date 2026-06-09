/**
 * UserRoleModel
 * Đại diện cho bảng 'user_roles' (junction table N-N) trong cơ sở dữ liệu.
 */
export class UserRoleModel {
  constructor(data = {}) {
    this.user_id = data.user_id || null;
    this.role_id = data.role_id || null; // FK -> roles.id ('USER' | 'MERCHANT' | 'ADMIN' | 'MODERATOR'...)
    this.assigned_at = data.assigned_at ? new Date(data.assigned_at) : null;
  }
}
