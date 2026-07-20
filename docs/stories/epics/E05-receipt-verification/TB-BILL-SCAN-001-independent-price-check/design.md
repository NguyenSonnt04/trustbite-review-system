# Design

## Domain Model

- `bill_scans` owns private upload metadata, OCR summary, provider state, and
  the overall normalized result.
- `bill_scan_line_items` owns observed OCR values, optional menu mapping,
  expected branch price, deterministic delta, confidence, and item result.
- A scan belongs to one user, active restaurant, and required active branch.

## Application Flow

1. Validate authentication, UUID v4 idempotency key, branch ownership, and
   JPG/PNG magic bytes.
2. Upload the private image to S3 and persist a `PROCESSING` scan.
3. Run Textract `AnalyzeExpense`.
4. Load available branch menu items and send only normalized item/menu data to
   Bedrock Gemma.
5. Validate the model JSON, calculate each numeric delta in application code,
   persist item and overall results transactionally, and return an allowlisted
   DTO.
6. On provider failure, persist `FAILED`, compensate uploaded storage when
   persistence fails, and return a safe provider error.

## Interface Contract

- `GET /api/v1/restaurants/:restaurantId/branches`
- `POST /api/v1/bill-scans`
- `GET /api/v1/bill-scans/:scanId`

All scan endpoints are authenticated. Scan reads are owner-only. The create
request uses multipart fields `restaurantId`, `branchId`, and `receiptImage`.

## Data Model

Migrations add `bill_scans`, `bill_scan_line_items`, owner/status indexes, an
owner-scoped idempotency key constraint, and processing attempt leases. Account
deletion removes owned bill-scan objects before deleting their rows. No
existing review table becomes nullable and no review receipt is synthesized.

## UI / Platform Impact

Mobile adds a clean `features/services/` registry for five future service
shortcuts and a `bill_scan/` feature containing repository, models, selection
page, and result page. Existing bottom navigation and visual language remain.

## Observability

Provider errors are logged without image bytes, S3 URLs, OCR text, prompts,
menu payloads, credentials, or model output. API responses expose a stable
error code only.

## Alternatives Considered

1. Reusing `receipt_verifications` was rejected because it requires a review
   and would mix trust evidence with an independent checking tool.
2. Letting the model decide price correctness was rejected because arithmetic
   must be deterministic and testable.
3. Comparing restaurant default prices was rejected because the user must
   select a branch and branch prices are authoritative.
