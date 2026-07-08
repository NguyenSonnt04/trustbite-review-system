# Overview

Story: TB-RECEIPT-OCR-001
Lane: high-risk
Epic: E05 Receipt Verification

## Problem

A receipt is uploaded and stored privately (earlier task), but nothing extracts
its content or moves it through the verification pipeline. Anti-Fraud §3 defines
the flow: file-format/size check → private store → SHA-256 hash + duplicate
check → OCR → merchant/time extraction → composite hash → score. Task 4.4 already
implements scoring/decision from extracted signals; Task 4.3 must produce those
signals asynchronously and reliably, because OCR is slow and provider calls fail.

## System Story

As the receipt pipeline, when a receipt is uploaded I enqueue an OCR job; the
worker computes the file hash and rejects exact duplicates (layer-1 hard rule),
runs Textract `AnalyzeExpense`, persists the extracted fields and line items, and
then runs the fraud decision — so users get a verification outcome without the
request blocking on OCR, and transient provider failures degrade to admin review
rather than a false fraud verdict.

## Acceptance Criteria

1. `enqueueReceiptOcr(receiptVerificationId)` adds a job to a BullMQ queue
   configured from env (no hardcoded Redis host/port/password).
2. The worker writes the Status_Mapping §4.3 pipeline states in order:
   `UPLOADED` → `HASH_CHECKING` → (`DUPLICATE_DETECTED` →) `OCR_PROCESSING` →
   `OCR_SUCCESS` | `OCR_FAILED`, and only §4.3 enum values are used.
3. Before OCR, a SHA-256 file-hash collision against a non-error existing receipt
   is a hard reject: status terminal-rejected, a `fraud_flags` row with code
   `DUPLICATE_RECEIPT_HASH` linked via `fraud_flag_entities`, and the review moved
   to the duplicate-rejected state (reusing Task 4.4's write path).
4. On OCR success, `ocr_text`, `ocr_restaurant_name`, `ocr_receipt_time`,
   `ocr_invoice_no`, `ocr_total_amount` and any `receipt_line_items` are written
   in one transaction, then `verifyReceipt()` runs the fraud decision.
5. Files failing format/size validation are rejected before hashing/scoring.
6. The Textract adapter loads the object from S3 and returns
   `{ rawText, restaurantName, receiptTime, invoiceNo, totalAmount, lineItems[] }`.
7. The mock provider fails closed outside `test`/`local` and is selected by env.
8. OCR timeout or provider error after the configured retries leaves the receipt
   at `PENDING_ADMIN_REVIEW` (review + receipt), with no fraud flag and no
   automatic fraud verdict.
9. Only columns present in `001_init_schema.sql` are written.

## Out of Scope

`POST /receipts` HTTP route + S3 upload, EXIF/metadata signals, live CI worker.

## Dependencies

- Task 4.4 `verifyReceipt()` (`receiptVerificationService.js`) — must exist. (it does)
- Tables: receipt_verifications, receipt_line_items, fraud_flags,
  fraud_flag_entities, reviews, restaurants.
- New deps: bullmq, ioredis (pinned). Redis from docker-compose (localhost:6379).
- S3 client (`@aws-sdk/client-s3`, already in deps); Textract client
  (`@aws-sdk/client-textract`, to add).
