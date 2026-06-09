/**
 * UserFollowModel
 * Đại diện cho bảng 'user_follows' (quan hệ tự liên kết N-N) trong cơ sở dữ liệu.
 */
export class UserFollowModel {
  constructor(data = {}) {
    this.follower_id = data.follower_id || null;
    this.following_id = data.following_id || null;
    this.created_at = data.created_at ? new Date(data.created_at) : null;
  }
}
