# Sơ đồ quan hệ thực thể - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Entity relationship diagram |
| Phiên bản | v2.6.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | DBA |
| Ngày cập nhật | 2026-06-07 |

---

## ERD logic

```mermaid
erDiagram
    users ||--o{ reviews : viet_danh_gia
    users ||--o{ otp_verifications : xac_thuc_otp
    users ||--o{ review_votes : binh_chon
    users ||--o{ account_deletion_requests : yeu_cau_xoa_tai_khoan
    users ||--o{ user_blocks : chan_nguoi_dung
    users ||--o{ user_blocks : bi_chan
    users ||--o{ favorites : luu_yeu_thich
    users ||--o{ merchants : lien_ket_chu_quan
    users ||--o{ audit_logs : thuc_hien_hanh_dong
    users ||--o{ idempotency_keys : tao_request

    restaurants ||--o{ reviews : nhan_danh_gia
    restaurants ||--o{ restaurant_branches : co_chi_nhanh
    restaurants ||--o{ menu_items : co_menu
    restaurants ||--o{ restaurant_claims : duoc_claim
    restaurants ||--o{ favorites : duoc_yeu_thich

    merchants ||--o{ restaurant_claims : gui_claim

    reviews ||--o{ receipt_verifications : duoc_xac_minh
    reviews ||--o{ review_media : co_media
    reviews ||--o{ review_votes : nhan_binh_chon

    moderation_reports ||--o{ moderation_actions : tao_hanh_dong

    users ||--o{ notifications : nhan_thong_bao
    idempotency_keys }o--|| receipt_verifications : tham_chieu_resource
```

## Ghi chú thiết kế chính

- `receipt_verifications` tách khỏi `reviews` để quản lý OCR/GPS/hash/rủi ro/quyết định quản trị độc lập.
- `idempotency_keys` chống tạo trùng request khi mobile retry, đặc biệt cho `POST /receipts`.
- `moderation_reports` dùng `entity_type/entity_id` để có thể báo cáo đánh giá, quán hoặc nội dung của chủ quán nếu cần.
- `audit_logs` dùng entity generic để ghi mọi quyết định vận hành quan trọng.
- `device_fingerprints` là tín hiệu bảo mật tùy chọn và phải tuân thủ chính sách quyền riêng tư.
- `account_deletion_requests` tách khỏi `users` để quản lý workflow, audit và lý do giữ dữ liệu tối thiểu khi xóa tài khoản.
- `user_blocks` hỗ trợ an toàn UGC/report-block trước khi đưa app lên store.
