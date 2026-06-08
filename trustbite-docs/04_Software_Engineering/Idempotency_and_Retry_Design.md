# Thiết kế idempotency và retry - TrustBite

| Thông tin tài liệu | Chi tiết |
|---|---|
| Loại tài liệu | Thiết kế kỹ thuật production-ready |
| Phiên bản | v1.0.0 |
| Trạng thái | Đang rà soát |
| Chủ sở hữu | Backend Lead / Mobile Lead / DBA |
| Ngày cập nhật | 2026-06-07 |

---

## 1. Mục tiêu

Đảm bảo các mutation dễ bị gọi lặp do mobile retry, mất mạng hoặc app foreground/background không tạo dữ liệu trùng, đặc biệt là upload hóa đơn.

---

## 2. Endpoint áp dụng

| Endpoint | Mức yêu cầu | Lý do |
|---|---|---|
| `POST /receipts` | Bắt buộc P0 | Upload có file, mobile retry dễ tạo receipt trùng. |
| `POST /reviews` | Khuyến nghị mạnh P0 | Người dùng có thể bấm lại khi mạng yếu. |
| `POST /moderation/reports` | Có thể dùng kết hợp unique business key | Đã có rule report trùng theo user/review/reason. |
| Admin decision endpoints | Không dùng replay tự động; dùng optimistic lock/version | Tránh lặp quyết định nghiệp vụ. |

---

## 3. Header và quy tắc client

```text
Idempotency-Key: <uuid-v4>
```

Quy tắc mobile:

- Một user intent tạo mới một key.
- Retry cùng intent phải gửi lại đúng key cũ.
- Khi người dùng chọn file khác hoặc sửa payload quan trọng, app phải tạo key mới.
- Key không được chứa thông tin cá nhân.
- Nếu app bị kill khi upload đang xử lý, app lưu key cục bộ tạm thời để khôi phục trạng thái bằng polling/refetch.

---

## 4. Bảng dữ liệu `idempotency_keys`

```sql
CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  endpoint VARCHAR(120) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
  response_status_code INTEGER,
  response_body JSONB,
  resource_type VARCHAR(60),
  resource_id UUID,
  locked_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint, idempotency_key)
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_resource ON idempotency_keys(resource_type, resource_id);
```

Retention đề xuất: 24-48 giờ cho `POST /receipts`, 24 giờ cho `POST /reviews`. Job retention xóa record hết hạn sau khi không còn cần replay response.

---

## 5. Tính `request_hash`

`request_hash = SHA-256(canonical_request)`.

Canonical request cho `POST /receipts` gồm:

- HTTP method + endpoint,
- `user_id`,
- `review_id`,
- `restaurant_id`,
- hash file upload SHA-256 nếu tính được trước khi ghi record hoàn tất,
- file size,
- normalized MIME type,
- GPS bucket hoặc giá trị GPS đã làm tròn nếu gửi kèm,
- `captured_at` nếu có.

Không đưa OTP, token, raw phone, OCR text hoặc dữ liệu nhạy cảm không cần thiết vào `request_hash` source log.

---

## 6. Luồng xử lý backend cho `POST /receipts`

1. Validate auth và quyền sở hữu review.
2. Validate `Idempotency-Key` đúng UUID v4.
3. Tính canonical request hash. Nếu cần đọc file để hash, xử lý trong transaction/lock ngắn nhất có thể.
4. Insert `idempotency_keys` với `IN_PROGRESS`.
5. Nếu insert bị conflict:
   - cùng `request_hash` và đã `COMPLETED`: trả lại `response_status_code` + `response_body` cũ.
   - cùng `request_hash` và `IN_PROGRESS`: trả `202` kèm resource hiện có nếu đã có, hoặc `409 REQUEST_IN_PROGRESS` nếu chưa có resource để poll.
   - khác `request_hash`: trả `409 IDEMPOTENCY_CONFLICT`.
6. Lưu file vào private storage.
7. Tạo `receipt_verifications` và enqueue OCR/hash job.
8. Cập nhật `idempotency_keys` thành `COMPLETED`, lưu `resource_type = RECEIPT_VERIFICATION`, `resource_id`, response snapshot.
9. Trả `202 Accepted`.

---

## 7. Tương tác với duplicate receipt hash

Idempotency và duplicate hash là hai lớp khác nhau:

- Idempotency xử lý cùng user intent gửi lặp.
- Duplicate receipt hash xử lý cùng file/hóa đơn bị dùng lại cho intent khác.

Nếu retry cùng `Idempotency-Key` và cùng payload, không tạo fraud flag duplicate.

Nếu key khác nhưng file hash đã tồn tại trong receipt verification đã hoàn tất hoặc đang xử lý cho review khác, áp dụng rule duplicate hash theo `State_Machines.md` và tạo `fraud_flags.DUPLICATE_RECEIPT_HASH`.

---

## 8. Status của `idempotency_keys`

| Status | Ý nghĩa | Hành vi retry |
|---|---|---|
| `IN_PROGRESS` | Request đang xử lý hoặc chưa lưu xong response | Trả resource để poll nếu có; nếu không có trả `REQUEST_IN_PROGRESS`. |
| `COMPLETED` | Đã có response ổn định | Replay response. |
| `FAILED_RETRYABLE` | Lỗi hạ tầng tạm thời trước khi tạo resource | Client có thể retry cùng key. |
| `FAILED_FINAL` | Request không hợp lệ hoặc không thể tiếp tục | Replay lỗi ổn định. |
| `EXPIRED` | Key hết hạn, không còn replay | Client phải refetch resource hoặc tạo intent mới. |

---

## 9. Error code bổ sung

| Code | HTTP | Ý nghĩa |
|---|---:|---|
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Endpoint bắt buộc key nhưng request thiếu. |
| `IDEMPOTENCY_KEY_INVALID` | 400 | Key sai định dạng. |
| `IDEMPOTENCY_CONFLICT` | 409 | Cùng key nhưng payload khác. |
| `REQUEST_IN_PROGRESS` | 409 hoặc 202 | Request cũ đang xử lý, client nên poll/refetch. |

---

## 10. Tiêu chí nghiệm thu

- Retry `POST /receipts` cùng key/payload không tạo thêm row `receipt_verifications`.
- Retry cùng key nhưng file khác trả `409 IDEMPOTENCY_CONFLICT`.
- Retry sau khi response bị mất trả lại cùng `receiptVerificationId`.
- Duplicate hash với key khác vẫn tạo fraud flag đúng rule.
- Không log raw file content, OTP, token, GPS raw ngoài nơi được phép.
- Có integration test mô phỏng timeout/mất mạng giữa lúc upload và nhận response.
