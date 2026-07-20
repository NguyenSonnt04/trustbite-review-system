# Threat Model for TrustBite

**Last Updated:** 2026-07-15
**Version:** 1.0.0
**Methodology:** STRIDE with repository-specific attack-pattern analysis
**Primary scan context:** Pre-commit review of admin restaurant bulk soft deletion

---

## 1. System Overview

### Architecture Description

TrustBite is a food-review platform that combines restaurant discovery and reviews with receipt OCR, GPS proximity checks, moderation, and trust scoring. The repository is a monorepo with these security-relevant components:

1. **Next.js web client and admin BFF** (`client/`) renders browser UI and exposes allowlisted same-origin `/api/admin/*` handlers. Admin browser code holds only an `HttpOnly`, `SameSite=Strict` opaque session cookie. Server-only Next.js code forwards the session marker and BFF credential to Express.
2. **Express API** (`server/src/`) owns business APIs, validation, authentication middleware, authorization, transaction orchestration, and provider adapters.
3. **PostgreSQL/PostGIS** stores users, TrustBite-local roles, restaurants, reviews, receipt-verification state, idempotency records, and audit records. Migrations in `server/migrations/` are the schema source of truth.
4. **Redis and BullMQ** support opaque admin sessions, authentication throttles, and asynchronous receipt OCR work.
5. **AWS provider boundary** integrates Cognito for identity and token issuance, S3 for private receipt and restaurant media, Textract for OCR, SES for email, and planned Bedrock summarization. LocalStack simulates supported providers locally.
6. **Flutter mobile client** consumes public and authenticated Express APIs and supplies untrusted review, receipt, and GPS inputs.

### Key Components

| Component | Purpose | Security Criticality | Attack Surface |
| --- | --- | --- | --- |
| Next.js client/admin BFF | Browser UI, same-origin mutation gate, secret-bearing server proxy | HIGH | Pages, route handlers, cookies, forwarded headers and bodies |
| Express API | Authentication, authorization, validation, domain operations | CRITICAL | Public and protected REST endpoints |
| Admin web auth/session | Cognito login, Redis opaque sessions, local-role revalidation | CRITICAL | Login, validate, logout, BFF headers, Redis records |
| Admin restaurant service | Profile/media management and atomic bulk soft deletion | CRITICAL | `/api/v1/admin-web/restaurants*` |
| PostgreSQL/PostGIS | Product, authorization, audit, and idempotency state | CRITICAL | Parameterized SQL, migrations, database credentials |
| Redis/BullMQ | Sessions, rate limits, queued OCR jobs | HIGH | Redis connection, serialized session/job payloads, workers |
| AWS adapters | Identity, objects, OCR, and email | HIGH | SDK calls, signed URLs, provider responses, IAM |
| Mobile client | User-facing review and verification workflow | MEDIUM | Cognito tokens, API input, device GPS and file selection |

### Data Flow

For an admin restaurant bulk deletion, an authenticated browser sends `POST /api/admin/restaurants/bulk-delete` with up to 100 UUIDs, a reason, and an idempotency key. The Next.js route requires a same-origin `Origin`, limits JSON to 32 KiB, reads the opaque cookie server-side, and forwards the request to `POST /api/v1/admin-web/restaurants/bulk-delete` with server-only BFF and session headers. Express compares the BFF secret, validates the Redis session, re-reads the active local user and current PostgreSQL roles, then validates the body and UUID-v4 idempotency key. `AdminRestaurantManagementService.deleteRestaurants` runs one PostgreSQL transaction that locks the idempotency row and all target restaurants, rejects a partial target set, soft-deletes every selected restaurant, writes one audit row per restaurant, records the completed response, and commits atomically. Errors roll back all mutation, audit, and idempotency work.

Other user flows cross the public internet into Next.js, Express, or Cognito. Express validates HTTP input before services. Services use parameterized PostgreSQL queries and provider adapters. Receipt files move to private S3 objects and OCR requests to Textract; queue workers consume Redis/BullMQ jobs and persist validated results.

---

## 2. Trust Boundaries & Security Zones

### Trust Boundary Definition

The system has five trust zones:

1. **Public/untrusted zone**
   - Actors: anonymous browsers, authenticated but potentially malicious users, mobile devices, uploaded files, GPS values, and arbitrary HTTP clients.
   - Entry points: public Next.js pages, Express public routes, Cognito login, receipt/media uploads, query parameters, headers, and JSON bodies.
2. **Authenticated user zone**
   - Actors: users presenting Cognito-compatible bearer tokens.
   - Boundary control: Express token verification, local identity mapping, active-account checks, deletion/suspension checks, and business authorization.
3. **Administrator browser zone**
   - Actors: browsers with an opaque admin cookie. Browser state is not trusted to assert identity or role.
   - Boundary control: same-origin mutation check, strict cookie attributes, route allowlist, body bounds, and no-store responses.
4. **BFF/application zone**
   - Actors: Next.js server handlers and Express.
   - Boundary control: server-only BFF shared secret, opaque session header, Redis session validation, Cognito subject binding, and a fresh PostgreSQL role/account lookup on every protected request.
5. **Data/provider zone**
   - Systems: PostgreSQL, Redis/BullMQ, Cognito, S3, Textract, SES, Bedrock, and LocalStack.
   - Boundary control: network isolation, environment-based credentials, parameterized SQL, provider adapters, private object storage, constrained object prefixes, SDK validation, and fail-closed errors.

### Authentication & Authorization

Cognito is the identity and token source of truth. Ordinary protected APIs verify Cognito JWTs and map the provider subject to a local user. Admin web login uses a dedicated Cognito app client, verifies the access token, maps the subject to an existing active local account, and requires a PostgreSQL `ADMIN` or `SUPER_ADMIN` role. Redis stores only a keyed-HMAC-addressed opaque marker with user ID, subject, and bounded expiry. Every admin request revalidates local account and role state. The browser-facing cookie is not accepted directly by Express; only the Next.js BFF may forward it with the server-only credential.

**Critical Security Controls:**

- Cognito-issued identity plus TrustBite-local role authorization, never provider groups alone.
- `HttpOnly`, `SameSite=Strict`, production `Secure` admin cookie and same-origin checks on mutations.
- Constant-time BFF-secret comparison and server-only configuration.
- Redis session records keyed by HMAC digest, bounded by provider token expiry, and revoked on invalidating account states.
- Parameterized SQL, explicit allowed fields, UUID validation, request-size limits, and bounded bulk size.
- Transactional soft deletion, row locks, idempotency conflict detection, all-target existence checks, audit writes, and rollback on error.
- `helmet`, CORS configuration, no-store admin responses, safe 5xx error bodies, and private S3 references.

### Boundary Gaps

- Express applies no general request-rate limiter to admin mutation routes. Login throttling does not limit repeated authenticated bulk-delete attempts.
- The BFF uses a shared static secret. Its rotation and overlap procedure is not documented in repository code.
- Audit rows are ordinary mutable PostgreSQL rows; no append-only permissions, external sink, signing, or tamper detection is documented.
- Production network controls, TLS termination, database/Redis encryption, backups, IAM least privilege, WAF rules, and secret rotation are deployment assumptions rather than repository-enforced controls.

---

## 3. Attack Surface Inventory

### External Interfaces

#### Admin HTTP Interfaces

- `POST /api/admin/restaurants/bulk-delete` (Next.js BFF)
  - **Input:** JSON `{ restaurantIds: UUID[1..100], reason: string[10..500] }`, UUID-v4 `Idempotency-Key`, opaque cookie.
  - **Validation:** exact route/method allowlist, same-origin `Origin`, 32 KiB streamed body cap, JSON parse, no-store response.
  - **Risk:** CSRF if origin enforcement regresses, XSS-driven same-origin requests, request amplification, cookie/session theft at the host boundary, or unsafe forwarding changes.
- `POST /api/v1/admin-web/restaurants/bulk-delete` (Express)
  - **Input:** BFF secret, opaque session header, idempotency header, bounded JSON body.
  - **Validation:** BFF authentication, session validation, current local admin role, exact field allowlist, canonical UUID set, reason bounds, UUID-v4 key.
  - **Risk:** BFF-secret compromise, stolen session, role-check bypass, authorization regression, replay/race errors, audit tampering, or transaction bugs causing data loss.
- `GET/PATCH /api/admin/restaurants*` and image mutation routes
  - **Input:** pagination/filter values, restaurant/image UUIDs, profile JSON, multipart media.
  - **Validation:** route allowlist, same-origin mutation gate, UUID and body validation, 6 MiB BFF multipart cap, server MIME/extension/signature checks, 5 MiB image cap.
  - **Risk:** IDOR, stored XSS through text fields, malicious files, oversized bodies, signed-URL leakage, or object ownership errors.
- Admin login/session routes
  - **Input:** email/password, cookies, client address.
  - **Validation:** bounded credentials, Redis address/email throttles, Cognito authentication, local account/role checks.
  - **Risk:** credential stuffing, address spoofing if proxy trust is wrong, user enumeration through behavior, Redis denial of service.

#### Public and Authenticated Express Interfaces

- Restaurant discovery, detail, menus, reviews, users, moderation, receipts, AWS support, and health routes under `/api/v1`.
- Inputs include JSON, URL/query values, Cognito JWT claims, multipart files, OCR text, receipt timestamps/hashes, GPS coordinates, and user-authored content.
- Primary risks are injection, broken object-level authorization, mass assignment, XSS in downstream renderers, upload abuse, fraud-signal spoofing, and computational/provider exhaustion.

#### File and Provider Interfaces

- Receipt and restaurant-image uploads can carry malformed or polyglot files.
- S3 object references and signed URLs can disclose data if bucket policy, key ownership, expiry, or logging is wrong.
- Textract/Bedrock output is untrusted provider data and must not become executable instructions or trusted HTML.
- BullMQ jobs and Redis sessions are serialized data that must be validated before use.
- Cognito/JWKS responses and claims cross an external-provider trust boundary.

### Data Input Vectors

1. Browser and mobile JSON, query, path, multipart, cookie, bearer-token, and custom-header inputs.
2. Administrator reasons, restaurant text, captions, and other stored content rendered later.
3. Receipt images, metadata, OCR output, object URLs/keys, and hashes.
4. GPS coordinates and IP-derived anti-fraud signals.
5. Cognito identities, claims, expiry values, JWKS material, and challenge responses.
6. Redis session/job payloads and PostgreSQL rows.
7. Environment variables controlling secrets, CORS, trusted proxy behavior, provider endpoints, buckets, and development-only auth paths.

---

## 4. Critical Assets & Data Classification

### PII and Sensitive User Data

- Emails, phone numbers, display names, dates of birth, Cognito subjects, addresses, IP-derived fraud signals, and device/session associations.
- Review text, moderation reports, saved lists, notifications, and user relationships.
- Receipt images, OCR text, transaction totals, timestamps, merchant data, and GPS coordinates.

**Protection measures:** authenticated APIs, local account-state checks, private provider storage, bounded signed URLs, database access controls, retention/deletion workflows, safe server errors, and no browser exposure of provider credentials.

### Credentials and Secrets

- Cognito client secrets, AWS credentials, database credentials, Redis access configuration, BFF secret, admin session HMAC secret, session cookies, bearer tokens, and signed object URLs.

**Protection measures:** environment or secret configuration, `server-only` Next.js module boundaries, no hardcoded production values, `HttpOnly` cookie, HMAC-derived Redis keys, no Cognito token persistence in the admin session, and server-side provider adapters.

### Business-Critical Data

- TrustBite-local user roles and account status, which authorize administrative actions.
- Restaurant identity, lifecycle state, soft-deletion markers, media ownership, and dependent historical records.
- Reviews, verification outcomes, receipt duplicate hashes, fraud flags, and trust-score inputs.
- Audit records and idempotency records that establish who acted and prevent duplicate mutation.
- Queue state, OCR outcomes, and provider cleanup state.

### Availability-Critical Assets

- PostgreSQL, Redis, Cognito, S3/Textract, Express, Next.js BFF, and worker processes.
- Database transactions and connection pools, Redis memory, provider quotas, and upload bandwidth.

---

## 5. Threat Analysis (STRIDE Framework)

### S - Spoofing Identity

#### Threat S1: Spoof an administrator or trusted BFF

**Scenario:** An attacker obtains an opaque admin marker, leaks the BFF secret, or reaches Express through a misconfigured internal network and submits bulk deletions as an administrator.

**Vulnerable components:** Next.js BFF, `bffAuth.js`, `adminWebAuth.js`, Redis session store, deployment secret/network configuration.

**Attack vector:**

1. Steal a session through host compromise, malicious extension, cookie misconfiguration, or server logs.
2. Obtain or bypass the static BFF credential.
3. Call the Express bulk-delete endpoint with both values.
4. Soft-delete up to 100 restaurants per request under the victim's identity.

**Code pattern to look for:**

```js
// VULNERABLE: trusts header or cookie presence.
if (req.header('x-trustbite-admin-session')) next();

// SAFE: authenticate BFF, validate the opaque record, bind subject and user,
// then re-read active account state and local roles.
router.use(requireAdminBff, requireAdminWebSession);
```

**Existing mitigations:** constant-time BFF-secret comparison, HMAC-addressed random session tokens, short bounded expiry, Redis revocation, Cognito subject binding, local user lookup, and role revalidation on every request.

**Gaps:** no documented BFF-secret rotation procedure, no admin MFA contract, and no device/session anomaly detection.

**Severity:** CRITICAL | **Likelihood:** LOW

#### Threat S2: Trust spoofed proxy or development authentication headers

**Scenario:** Production enables broad proxy trust or development-only trusted authentication headers, allowing attacker-controlled network headers to influence identity or anti-fraud signals.

**Existing mitigations:** `TRUST_PROXY` defaults false; trusted headers are documented for non-production use only; Cognito remains the normal identity authority.

**Gaps:** deployment configuration is outside repository enforcement. Add configuration tests that production rejects trusted local auth and overly broad proxy trust where feasible.

**Severity:** HIGH | **Likelihood:** LOW

### T - Tampering with Data

#### Threat T1: Partial, replayed, or race-corrupted bulk deletion

**Scenario:** Concurrent requests, duplicate delivery, mixed existing/deleted IDs, or a reused idempotency key produce partial deletion, duplicate audit records, or a response inconsistent with database state.

**Vulnerable components:** `AdminRestaurantManagementService.deleteRestaurants`, `idempotency_keys`, `restaurants`, and `audit_logs`.

**Attack vector:**

1. Send concurrent requests with the same or different keys and overlapping restaurant IDs.
2. Trigger a failure after some updates or audit writes.
3. Exploit missing locking or transaction boundaries.
4. Leave only part of the selected set deleted or duplicate evidence.

**Code pattern to look for:**

```js
// VULNERABLE: independent updates without locks or transaction.
for (const id of restaurantIds) await pool.query(`UPDATE restaurants SET is_deleted = TRUE WHERE id = '${id}'`);

// SAFE: parameterized set update inside BEGIN/COMMIT after FOR UPDATE locks,
// exact row-count verification, and transactional audit/idempotency writes.
await client.query('BEGIN');
await client.query('SELECT id FROM restaurants WHERE id = ANY($1::uuid[]) FOR UPDATE', [ids]);
await client.query('UPDATE restaurants SET is_deleted = TRUE, deleted_at = NOW() WHERE id = ANY($1::uuid[])', [ids]);
```

**Existing mitigations:** canonical sorted/deduplicated UUID set, 100-item limit, actor-and-payload request hash, unique idempotency scope, `FOR UPDATE`, all-target row-count check, one transaction, parameterized arrays, rollback, and completed-response replay.

**Gaps:** keep explicit tests for overlapping requests with different keys, lock timeout behavior, database disconnects at each transactional stage, and idempotency expiry/retry races.

**Severity:** HIGH | **Likelihood:** MEDIUM

#### Threat T2: Soft-deleted restaurant leaks or remains mutable

**Scenario:** A query omits `is_deleted = FALSE`, exposing or modifying logically deleted restaurants through public, admin, review, menu, media, or background-job paths.

**Existing mitigations:** architecture decision requires default filtering; restaurant services and bulk target selection apply the filter; integration tests cover core read/update exclusion.

**Gaps:** SQL has no row-level policy or view that enforces the filter globally. Every new query can regress. Dependent branches, reviews, menus, claims, and images are intentionally not cascade-deleted, so each consumer must define parent visibility.

**Severity:** HIGH | **Likelihood:** MEDIUM

### R - Repudiation

#### Threat R1: Administrator denies a destructive action

**Scenario:** An admin claims that a bulk deletion was not theirs, or an attacker with database access edits/deletes audit rows to hide the action.

**Vulnerable components:** `audit_logs`, application/database administration, clocks, operational logging.

**Existing mitigations:** each deleted restaurant receives actor ID, current actor role, action, previous status, mandatory reason, bulk-size metadata, and database timestamp in the same transaction as deletion.

**Gaps:** audit records are not append-only or externally replicated, no request/session/correlation ID is stored, no source address is recorded, no read API or alerting exists, and free-text reasons can contain unnecessary sensitive data. Actor deletion can set `actor_id` to null.

**Severity:** HIGH | **Likelihood:** MEDIUM

#### Threat R2: Idempotent replay obscures request history

**Scenario:** A completed response is replayed without a new audit row, and operators cannot distinguish the original attempt from later retries.

**Existing mitigations:** `Idempotency-Replayed: true` is returned by Express and the idempotency row retains timestamps and response.

**Gaps:** replay attempts are not independently recorded in immutable operational telemetry.

**Severity:** LOW | **Likelihood:** MEDIUM

### I - Information Disclosure

#### Threat I1: Admin-only or deleted restaurant data leaks

**Scenario:** Draft/suspended details, soft-deleted records, signed media URLs, audit reasons, or PII are returned through a public route, cache, verbose error, or log.

**Existing mitigations:** admin routes require BFF plus session, default restaurant queries filter deleted rows, responses are `no-store`, S3 references are private, signed URLs are short-lived, 5xx responses are generic, and Helmet is enabled.

**Gaps:** verify CDN/reverse-proxy cache behavior, log redaction, signed-URL expiry, and all parent-child queries. CORS may be permissive outside production when no origins are configured, although admin Express requests still need non-browser secrets.

**Severity:** HIGH | **Likelihood:** MEDIUM

#### Threat I2: Secrets or tokens cross into browser code

**Scenario:** A refactor moves `ADMIN_WEB_BFF_SECRET`, Cognito client secret, AWS key, or provider token into a `NEXT_PUBLIC_*` variable, response body, client bundle, or log.

**Existing mitigations:** `admin-auth.server.js` imports `server-only`; the browser has only an opaque `HttpOnly` cookie; Cognito tokens are not persisted in Redis; server configuration reads environment variables.

**Gaps:** repository-level secret scanning and built-bundle checks should run on every commit.

**Severity:** CRITICAL | **Likelihood:** LOW

### D - Denial of Service

#### Threat D1: Authenticated mutation and database-lock exhaustion

**Scenario:** A compromised or malicious admin repeatedly submits 100-ID overlapping batches, holds row locks, grows idempotency/audit tables, and consumes the database pool.

**Existing mitigations:** 100-ID and 32 KiB limits, strict validation before connection acquisition, transaction rollback, five-minute idempotency lock, and client-side 30-second fetch timeout.

**Gaps:** no per-admin or route-level mutation rate limit, no documented statement/lock timeout, no queueing/backpressure, and no idempotency/audit retention enforcement stated for this path.

**Severity:** HIGH | **Likelihood:** MEDIUM

#### Threat D2: Upload, OCR, queue, or provider quota exhaustion

**Scenario:** Attackers submit many valid-sized files or expensive OCR jobs, exhaust memory, Redis, worker concurrency, S3/Textract quota, or signed-URL generation.

**Existing mitigations:** file/body limits, type/signature checks, bounded API timeouts, Redis-backed login throttling, and service boundaries.

**Gaps:** global upload and OCR rate limits, malware scanning, queue admission limits, provider budgets, dead-letter monitoring, and circuit breakers require verification.

**Severity:** HIGH | **Likelihood:** MEDIUM

### E - Elevation of Privilege

#### Threat E1: Non-admin gains restaurant deletion authority

**Scenario:** A valid user token, Cognito group, client-side role, or stale session is treated as sufficient for admin mutation.

**Vulnerable components:** auth middleware, identity mapping, role normalization, BFF routes, admin service.

**Code pattern to look for:**

```js
// VULNERABLE: provider claim or browser state grants product authority.
if (token.groups.includes('ADMIN') || body.role === 'ADMIN') deleteRestaurants();

// SAFE: use freshly loaded TrustBite-local roles and enforce again in service.
const roles = user.databaseRoles;
getActorRole({ id: user.id, roles });
```

**Existing mitigations:** PostgreSQL `user_roles` is the authority; Cognito groups do not grant product roles; admin session validation re-reads state; route middleware and service both enforce an admin role; role removal invalidates the next request.

**Gaps:** both `ADMIN` and `SUPER_ADMIN` can bulk delete restaurants. If deletion requires a higher tier or dual approval, that policy is not present. No step-up authentication is required for this destructive operation.

**Severity:** CRITICAL | **Likelihood:** LOW

#### Threat E2: IDOR or ownership bypass in related media and restaurant routes

**Scenario:** An administrator or ordinary user changes path IDs to access another restaurant's media or a non-public restaurant through a route missing authorization or parent-child binding.

**Existing mitigations:** UUID validation, admin middleware, local roles, restaurant/media authorization services, and owned S3 prefix restrictions.

**Gaps:** every new route must prove object and parent-child authorization. Generic restaurant mutation routes must not become an alternate weaker admin path.

**Severity:** HIGH | **Likelihood:** MEDIUM

---

## 6. Vulnerability Pattern Library

### SQL Injection

```js
// VULNERABLE
await pool.query(`SELECT * FROM restaurants WHERE id = '${req.params.id}'`);
await pool.query(`SELECT * FROM restaurants ORDER BY ${req.query.sort}`);

// SAFE
await pool.query('SELECT * FROM restaurants WHERE id = $1 AND is_deleted = FALSE', [id]);
const orderBy = allowedSorts.get(req.query.sort) ?? 'updated_at DESC';
```

Flag string interpolation, concatenation, dynamic `ORDER BY`, unvalidated identifiers, and raw PostGIS fragments. Parameterize values and allowlist unavoidable SQL identifiers.

### XSS and HTML Injection

```jsx
// VULNERABLE
<div dangerouslySetInnerHTML={{ __html: restaurant.description }} />

// SAFE
<div>{restaurant.description}</div>
```

Treat restaurant names, descriptions, addresses, admin reasons, review text, OCR text, captions, and provider-generated summaries as untrusted stored content. Avoid HTML rendering; if required, sanitize with an installed and maintained allowlist sanitizer.

### Command Injection

```js
// VULNERABLE
exec(`convert ${upload.originalname} ${outputPath}`);
eval(job.payload.expression);

// SAFE
spawn('convert', [validatedInputPath, validatedOutputPath], { shell: false });
```

No current business path should invoke a shell. Flag `exec`, `execSync`, `spawn` with `shell: true`, `eval`, `Function`, or command construction from file names, OCR text, URLs, or request values.

### Path Traversal and Object-Key Confusion

```js
// VULNERABLE
const path = join(uploadRoot, req.params.name);
await s3.send(new DeleteObjectCommand({ Bucket, Key: req.body.key }));

// SAFE
const safeName = crypto.randomUUID();
assertOwnedRestaurantImageKey(key, restaurantId);
```

Reject `..`, absolute paths, encoded separators, drive prefixes, and user-selected S3 keys. Generate names server-side and constrain destructive object operations to `restaurant-images/<restaurantId>/`.

### Authentication and BFF Bypass

```js
// VULNERABLE
router.post('/restaurants/bulk-delete', deleteAdminRestaurants);
if (req.cookies.trustbite_admin_session) req.user = decode(req.cookies.trustbite_admin_session);

// SAFE
router.use(requireAdminBff, requireAdminWebSession);
router.post('/restaurants/bulk-delete', deleteAdminRestaurants);
```

Flag admin routes mounted before middleware, cookie presence checks, unsigned session objects, browser-readable provider tokens, fallback JWT issuers, trusted local headers in production, and role grants from Cognito groups alone.

### IDOR and Missing Parent Visibility

```js
// VULNERABLE
await pool.query('UPDATE restaurant_images SET caption = $1 WHERE id = $2', [caption, imageId]);

// SAFE
await pool.query(
  `UPDATE restaurant_images
   SET caption = $1
   WHERE id = $2 AND restaurant_id = $3
     AND EXISTS (
       SELECT 1 FROM restaurants r
       WHERE r.id = $3 AND r.is_deleted = FALSE
     )`,
  [caption, imageId, restaurantId],
);
```

Flag direct access by path UUID without role, owner, tenant, parent relationship, account-state, or soft-delete checks.

### Mass Assignment and Boundary Validation

```js
// VULNERABLE
await updateRestaurant(id, req.body);

// SAFE
assertAllowedFields(req.body, RESTAURANT_UPDATE_FIELDS);
const updates = { name: normalizeName(req.body.name), status: normalizeStatus(req.body.status) };
```

Flag object spreading from request/provider/database data into mutations, especially fields such as `roles`, `status`, `is_deleted`, `trust_score`, object keys, actor IDs, or audit fields.

### Soft-Delete Regression

```sql
-- VULNERABLE
SELECT * FROM restaurants WHERE id = $1;
UPDATE restaurants SET status = $2 WHERE id = $1;

-- SAFE
SELECT * FROM restaurants WHERE id = $1 AND is_deleted = FALSE;
UPDATE restaurants SET status = $2 WHERE id = $1 AND is_deleted = FALSE;
```

Flag every restaurant read, aggregate, join, update, media operation, background job, and public child-resource query that does not intentionally define behavior for a deleted parent.

### Idempotency and Audit Integrity

```js
// VULNERABLE
await deleteRows(ids);
await writeAudit(actor, ids); // separate transaction or best effort

// SAFE
await client.query('BEGIN');
// lock idempotency + targets, mutate, audit, persist response
await client.query('COMMIT');
```

Flag idempotency hashes that omit actor, endpoint, canonical IDs, or security-relevant body fields; keys shared across users/endpoints; completed responses written outside the mutation transaction; and destructive actions whose audit insert can fail independently.

### SSRF and Provider Boundary

```js
// VULNERABLE
const response = await fetch(req.body.imageUrl);

// SAFE
const url = new URL(candidate);
if (!allowedHosts.has(url.hostname) || url.protocol !== 'https:') reject();
```

Flag server-side fetches of avatar/media/provider URLs without strict scheme/host rules, redirects to private networks, or use of client-provided AWS endpoints, buckets, or regions.

### Secrets and Sensitive Logging

```js
// VULNERABLE
console.log({ password, accessToken, sessionToken, bffSecret, receiptOcr });

// SAFE
console.info({ requestId, actorId, action: 'RESTAURANT_BULK_DELETE', count: ids.length });
```

Flag secrets in source, `NEXT_PUBLIC_*`, errors, logs, audit reasons, test fixtures that resemble real credentials, Redis payloads, or response bodies.

---

## 7. Security Testing Strategy

### Pre-Commit and CI Checks

| Check | Purpose | Frequency |
| --- | --- | --- |
| Focused Vitest unit tests | Middleware order, BFF/session rejection, body/header validation, replay behavior | Every relevant commit |
| PostgreSQL integration tests | Atomic deletion, locks, rollback, audit, idempotency, soft-delete visibility | Every relevant commit with migrated local DB |
| `npm run server:build` | Parse/syntax validation across server files | Every server commit |
| Client lint/build scripts when client changes | Server/client boundary and bundle compilation | Every client/BFF commit |
| Dependency audit/scanner | Known npm, Flutter, container, and GitHub Action vulnerabilities | Every commit and scheduled |
| Secret scanning | Prevent credentials and tokens in source/history | Every commit |
| SAST/semantic scan | Injection, auth bypass, IDOR, SSRF, unsafe file and crypto patterns | Every commit |
| IaC/container scan | Terraform, Docker Compose, image and network misconfiguration | Every infrastructure commit |
| DAST on staging | Auth, CORS, headers, body limits, endpoint exposure, and rate limits | Scheduled and before release |

### Required Bulk-Delete Security Tests

1. Reject absent/wrong BFF secret and absent/malformed/expired/revoked session.
2. Reject ordinary users, Cognito-group-only admins, suspended/deleted users, active deletion requests, and users whose local role was removed after login.
3. Reject missing `Origin` and cross-origin browser mutations at the BFF.
4. Reject unsupported fields, non-object JSON, invalid/duplicate/empty/over-100 IDs, short/oversized reason, missing/non-v4 key, oversized body, and malformed JSON without database residue.
5. Prove all selected rows are deleted or none are, including one missing/already-deleted ID and injected failures after lock, update, audit, and idempotency writes.
6. Prove same-key/same-payload replay, same-key/different-payload conflict, expired-key retry, active lock conflict, concurrent same-key requests, and overlapping different-key requests.
7. Prove one audit row per restaurant with correct actor/current role/previous status/reason/metadata and no duplicate audit on replay.
8. Prove deleted restaurants disappear from every public/admin read and reject update/media mutation while dependent historical data follows its documented visibility contract.
9. Prove SQL parameterization with hostile reason/ID strings and safe rendering of reason/text in any future audit UI.
10. Apply migrations, run tests inside rollback/cleanup controls, and verify no residual restaurant, audit, or idempotency changes after negative paths.

### Manual Review Gates

Human security review is required for HIGH or CRITICAL findings, authentication/authorization changes, admin mutation routes, role policy, BFF/session changes, schema/deletion semantics, audit retention, provider/IAM changes, cryptography, trusted-proxy changes, and any weakening of validation.

---

## 8. Mitigations, Gaps, Assumptions, and Accepted Risks

### Priority Mitigations

1. Preserve the layered admin boundary: same-origin BFF, server-only credential, Redis session validation, fresh local account/role lookup, and service-level authorization.
2. Keep bulk deletion all-or-nothing with canonical IDs, bounded batch size, row locks, parameterized SQL, idempotency, transactional audit, and rollback.
3. Add per-admin destructive-mutation throttling and database statement/lock timeouts appropriate to the deployment.
4. Protect audit evidence with restricted append-only database permissions and export/alerting to a separate security log sink.
5. Add MFA or step-up authentication and consider `SUPER_ADMIN` or dual approval if product policy classifies bulk deletion as especially destructive.
6. Continuously test `is_deleted = FALSE` behavior across all parent and child queries.
7. Automate secret, dependency, SAST, IaC, and container scanning in CI.

### Known Gaps

- No repository-enforced route-level rate limit for authenticated admin mutations.
- No immutable or externally anchored audit trail, audit read surface, or security alert for bulk deletion.
- No documented MFA, step-up, dual-control, or higher-tier requirement for bulk deletion.
- No universal database policy that prevents accidental reads or writes of soft-deleted restaurants.
- No documented restoration workflow for an erroneously soft-deleted restaurant.
- No formal OpenAPI contract and no single schema validator across all HTTP boundaries.
- Production TLS, WAF, network segmentation, IAM, backups, database encryption, Redis authentication/TLS, key rotation, and monitoring are not proven by application code.
- Malware scanning and provider/queue abuse controls require verification for uploads and OCR.

### Security Assumptions

1. Production traffic uses TLS end to end through trusted proxy/load-balancer hops, and `TRUST_PROXY` matches only those hops.
2. BFF, session-HMAC, Cognito, AWS, PostgreSQL, and Redis secrets are supplied by an access-controlled secret manager, are never exposed to browser code, and are rotated operationally.
3. PostgreSQL and Redis are not publicly reachable and use least-privilege service identities.
4. Cognito issuer, audience, token use, signature, expiry, and subject are verified by the provider adapter before local mapping.
5. Next.js server and Express communicate over an authenticated, restricted deployment path; the BFF secret is defense in depth, not a replacement for network controls.
6. Server clocks are synchronized because token, session, idempotency, audit, and signed-URL expiry depend on time.
7. S3 buckets are private, object ownership checks are enforced, and signed URLs are short-lived.

### Accepted Risks

1. **Soft deletion does not cascade to restaurant children.** This preserves historical integrity by design, but every consumer must enforce parent visibility until a later accepted lifecycle decision changes it.
2. **Both `ADMIN` and `SUPER_ADMIN` may manage restaurants.** This is the current accepted product authorization policy; it increases impact of a compromised `ADMIN` account.
3. **Redis/PostgreSQL failure blocks admin access.** The admin session design intentionally fails closed, accepting an availability tradeoff to prevent stale authorization.
4. **LocalStack and development credentials are not production controls.** They are accepted only for local simulation and must not be treated as production security proof.

---

## 9. Threat Model Changelog

### Version 1.0.0 (2026-07-15)

- Created the initial repository-wide STRIDE threat model.
- Mapped Next.js, Express, PostgreSQL/PostGIS, Redis/BullMQ, Cognito, S3, Textract, SES, Bedrock, LocalStack, and Flutter trust boundaries.
- Added stack-specific vulnerability patterns and verification strategy.
- Added focused analysis for admin restaurant bulk soft deletion, including BFF/session authentication, local-role authorization, atomicity, idempotency, auditability, denial of service, and soft-delete visibility.
