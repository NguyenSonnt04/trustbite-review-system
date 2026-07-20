# Bill Price Check

## Product Contract

Authenticated mobile users can scan a receipt independently from creating a
review and compare each OCR line item with the electronic menu of one selected
restaurant branch.

## User Flow

1. Open `Quét bill` from `Dịch vụ khác`.
2. Search for a restaurant and select one active branch.
3. Confirm the restaurant name, branch address, and area.
4. Capture or choose a JPG/PNG receipt image and submit it.
5. Wait while the backend stores the private image, extracts line items with
   Textract, maps item names with Bedrock Gemma, and calculates price deltas.
6. View a separate result page and confirm whether the comparison looks
   correct.

## Price Decision Rules

- Branch selection is required.
- The branch must be active and belong to the selected active restaurant.
- Expected price uses an available `branch_menu_items.price`.
- An OCR line item is `MATCHED` when Bedrock maps it to one branch menu item.
- A matched line item is `PRICE_MISMATCH` when
  `abs(observed_unit_price - expected_unit_price) > 1000` VND.
- A difference of exactly 1,000 VND is accepted.
- Unmatched or unreadable items are `INCONCLUSIVE`; they do not become a price
  mismatch.
- The overall result is `PRICE_MISMATCH` when any item is mismatched,
  `INCONCLUSIVE` when no item is mismatched and at least one is inconclusive,
  otherwise `MATCHED`.
- Backend arithmetic is authoritative. Bedrock may map names and explain the
  normalized result, but it must not decide numeric price correctness.
- Taxes, service fees, discounts, and final bill total comparison are out of
  scope for this story.

## API Contract

### GET `/api/v1/restaurants/:restaurantId/branches`

Returns active branches for an active restaurant. Each item exposes only
`id`, `restaurantId`, `name`, `address`, `area`, `latitude`, and `longitude`.

### POST `/api/v1/bill-scans`

Protected multipart request with:

- `Idempotency-Key`: required UUID v4.
- `restaurantId`: required UUID.
- `branchId`: required UUID.
- `receiptImage`: one JPG or PNG file, maximum 10 MB.

The endpoint returns the completed owner-scoped result for the initial
synchronous MVP. Provider or OCR failures return the standard error envelope
and persist a failed scan without exposing the private S3 URL, image hash,
provider payload, credentials, or internal prompt.

### GET `/api/v1/bill-scans/:scanId`

Returns only the authenticated owner's normalized scan result.

## Data And Privacy

- Bill scans are distinct from review receipt verification records.
- Images remain private S3 objects under a bill-scan-specific prefix.
- API DTOs use explicit allowlists and never expose object URLs, hashes,
  provider payloads, prompts, or user IDs.
- Account deletion removes owned bill-scan objects and database rows through
  the existing durable cleanup workflow.
- Processing attempts use a bounded lease and an attempt token so an abandoned
  request can be retried without allowing an older worker to overwrite it.
- Duplicate images may be rescanned by the same user for this checking tool;
  they do not mutate review verification, trust score, or price history.

## Validation

- Unit proof covers Bedrock response validation and the 1,000 VND threshold.
- Integration proof covers auth, ownership, branch/restaurant validation,
  idempotency, persistence, provider failure, and private-field omission.
- Mobile widget/service proof covers selection, image submission, loading,
  errors, and result rendering.
