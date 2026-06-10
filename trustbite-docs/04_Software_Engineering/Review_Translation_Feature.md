# Tính năng dịch bình luận review

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Đặc tả tính năng / contract sản phẩm |
| Phiên bản | v1.0.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Backend / Mobile / Product / Legal |
| Ngày cập nhật | 2026-06-10 |

---

## 1. Mục tiêu

Cho phép người dùng đọc review bằng ngôn ngữ phù hợp với họ mà không thay đổi nội dung gốc. UX phải giống mô hình phổ biến trên mạng xã hội: có nút `Dịch` và `Xem bản gốc`.

## 2. Quy tắc sản phẩm

- Review gốc luôn là source of truth.
- Bản dịch chỉ là dữ liệu hiển thị.
- Không tự động dịch toàn bộ comment khi load danh sách.
- Chỉ dịch khi người dùng bấm `Dịch`.
- Người dùng có thể quay về `Xem bản gốc` mà không gọi lại backend.
- Bản dịch không được dùng cho trust score, fraud scoring, OCR, hay moderation.
- Không dịch review hidden/deleted/không được phép xem.

## 3. UX

Mỗi comment có thể hiển thị:

- `Dịch`
- trạng thái loading
- text đã dịch
- `Xem bản gốc`
- nhãn nhỏ `Được dịch tự động`

Khi lỗi dịch:

- giữ nguyên bản gốc,
- hiện copy lỗi nhẹ,
- không làm hỏng layout list/detail.

## 4. API contract

### POST /api/v1/reviews/{reviewId}/translation

Auth: người dùng hiện tại.

Request:

```json
{
  "targetLocale": "vi"
}
```

Response:

```json
{
  "reviewId": "uuid",
  "sourceLocale": "en",
  "targetLocale": "vi",
  "originalTextHash": "sha256...",
  "translatedText": "Món ăn rất ngon, phục vụ nhanh.",
  "provider": "GOOGLE_TRANSLATE",
  "cached": true
}
```

Lỗi:

- `401 AUTH_REQUIRED`
- `403 REVIEW_NOT_VISIBLE`
- `404 REVIEW_NOT_FOUND`
- `409 REVIEW_TRANSLATION_STALE`
- `422 UNSUPPORTED_TARGET_LOCALE`
- `422 TRANSLATION_TEXT_EMPTY`
- `429 TRANSLATION_RATE_LIMITED`
- `503 TRANSLATION_PROVIDER_UNAVAILABLE`

## 5. Data model

Cache translation theo `reviewId + targetLocale + sourceTextHash`.

```sql
CREATE TABLE review_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  target_locale VARCHAR(10) NOT NULL,
  source_locale VARCHAR(10),
  source_text_hash TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'GOOGLE_TRANSLATE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, target_locale, source_text_hash)
);
```

## 6. Provider

- Dùng Google Cloud Translation qua backend service.
- Không gọi Google trực tiếp từ client.
- Không commit credential vào source.
- Không gửi phone number, token, GPS, receipt image, OCR text, audit data, hay nội dung private/deleted.

Suggested env:

```text
GOOGLE_TRANSLATION_PROJECT_ID=<project-id>
GOOGLE_TRANSLATION_LOCATION=global
GOOGLE_APPLICATION_CREDENTIALS=<runtime-secret-or-mounted-path>
```

## 7. Privacy / store

Khi người dùng bấm dịch, TrustBite có thể gửi nội dung bình luận tới Google Cloud Translation để tạo bản dịch. Điều này phải được khai báo trong privacy/store docs.

## 8. Acceptance

- Hiện nút `Dịch` khi review khác ngôn ngữ người dùng.
- Bấm `Dịch` trả text đã dịch từ backend.
- `Xem bản gốc` quay về review gốc mà không gọi provider lại.
- Cache hit không gọi Google lại.
- Review không được phép xem không thể dịch.
- Provider lỗi giữ nguyên bản gốc.
