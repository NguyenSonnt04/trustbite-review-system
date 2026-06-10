# Backend Model Guide - TrustBite

| Thong tin tai lieu | Chi tiet |
|---|---|
| Loai tai lieu | Model directory guide |
| Phien ban | v1.0.0 |
| Trang thai | Da cap nhat |
| Chu so huu | Backend / DBA |
| Ngay cap nhat | 2026-06-09 |

---

## 1. Muc dich
`server/src/models/` cua TrustBite.

Muc tieu:

- moi bang runtime trong schema PostgreSQL deu co model class tuong ung,
- model class phai khop ten cot va kieu gia tri trong schema,
- model khong duoc lam mat gia tri hop le `0`, `false`, hoac chuoi rong neu DB co the tra ve chung,
- khong dua logic nghiep vu hoac validation API vao model class.

---

## 2. Source of truth

Thu tu uu tien khi doi chieu:

1. `trustbite-docs/06_Database_Design/PostgreSQL_Database_Schema.md`
2. `trustbite-docs/02_Business_Analysis/Status_Mapping.md`
3. `trustbite-docs/06_Database_Design/Data_Dictionary.md`
4. `trustbite-docs/06_Database_Design/ERD.md`

Neu `Data_Dictionary.md` hoac `ERD.md` cu hon schema moi, schema moi la nguon chinh.

---

## 3. Cay thu muc model

```text
server/src/models/
  auth/
  user/
  restaurant/
  review/
  moderation/
  gamification/
  system/
```

Quy uoc:

- moi file `.js` dai dien 1 model class,
- ten file dung camelCase,
- ten class dung PascalCase va ket thuc bang `Model`,
- nhom thu muc phai khop voi domain nghiep vu.

---

## 4. Mapping thu muc -> bang

| Thu muc | Bang / model chinh |
|---|---|
| `auth/` | `otp_purposes`, `otp_verifications`, `user_sessions` |
| `user/` | `users`, `roles`, `user_roles`, `rank_definitions`, `user_follows` |
| `restaurant/` | `restaurants`, `restaurant_branches`, `menu_items`, `branch_menu_items`, `restaurant_operating_hours`, `restaurant_images`, `merchants`, `restaurant_merchants`, `restaurant_claims`, `restaurant_categories`, `restaurant_category_map`, `amenities`, `restaurant_amenities`, `payment_methods`, `restaurant_payment_methods` |
| `review/` | `reviews`, `review_tags`, `review_replies`, `receipt_verifications`, `receipt_line_items`, `receipt_line_item_menu_maps`, `review_media`, `review_votes`, `price_history`, `review_summaries`, `tags` |
| `moderation/` | `moderation_reports`, `moderation_actions`, `fraud_flags`, `fraud_flag_entities`, `fraud_rule_configs`, `report_reason_codes` |
| `gamification/` | `badge_definitions`, `user_badges`, `exp_transactions`, `user_saved_lists`, `user_saved_list_restaurants` |
| `system/` | `notifications`, `notification_delivery_logs`, `push_tokens`, `idempotency_keys`, `audit_logs`, `account_deletion_requests`, `user_blocks`, `admin_queues`, `admin_queue_assignments` |

---

## 5. Model rules

### 5.1. Mapping rules

- Dung `??` hoac kiem tra `!= null` khi map gia tri co the la `0` hoac `false`.
- Chi parse number khi cot la numeric/int trong schema.
- Chi convert `Date` cho cot timestamp/date.
- Khong tu suy dien enum moi neu schema / status mapping chua chot.

### 5.2. Relationship rules

- Bang trung gian N-N co model rieng.
- Bang seed/config (`roles`, `rank_definitions`, `badge_definitions`, `otp_purposes`, `report_reason_codes`, `restaurant_categories`, `amenities`, `payment_methods`, `tags`, `fraud_rule_configs`) van co model rieng.
- `users.role` khong phai contract chinh; phan quyen dung `roles` + `user_roles`.
- `fraud_flags` khong co FK truc tiep den user/review/receipt; moi loader tra ve fraud flag phai JOIN `fraud_flag_entities` va map vao `FraudFlagModel.entities`.

### 5.3. Sensitive field rules

- `receipt_verifications.ocr_text` la OCR raw co the chua PII. Khong tra field nay trong API response; `ReceiptVerificationModel.toJSON()` mac dinh loai bo `ocr_text`.

### 5.4. Naming rules

- `user_id`, `restaurant_id`, `review_id` giu nguyen snake_case theo DB.
- Ten file va ten class phai khop nghia:
  - `user.js` -> `UserModel`
  - `role.js` -> `RoleModel`
  - `restaurantCategoryMap.js` -> `RestaurantCategoryMapModel`

---

## 6. Khi nao can them model moi

Them model file moi khi:

- co bang runtime moi trong schema,
- co bang seed/config moi duoc chon lam contract,
- co bang junction moi phuc vu quan he N-N,
- co bang phat sinh tu story da duoc chap nhan.

Khong can them model moi khi:

- chi co view, report tam, hoac derived output khong luu DB,
- chi doi ten cot trong docs cu ma schema chinh chua doi,
- chi doi API shape ma khong doi data model.

---

## 7. Kiem tra nhanh cho AI sau

Truoc khi sua model:

1. Doi chieu schema v2.7.0.
2. Kiem tra status mapping neu lien quan review/receipt/trust.
3. Cap nhat model class truoc khi sua service hoac controller.
4. Giu count model files bang so bang runtime trong schema.
5. Import smoke tat ca file `server/src/models/*.js` sau khi sua.

---

## 8. Tinh trang hien tai

- Schema table count: 54.
- Model file count: 54.
- Model folder da bao phu cac bang trong schema v2.7.0.
- Migration baseline thuc thi nam o `server/migrations/001_init_schema.sql`.
- Chay `npm run db:migrate` de tao bang that trong PostgreSQL local.
