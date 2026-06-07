# Story Backlog

This backlog tracks candidate TrustBite work. Do not create every possible story packet up front. Create or update a story packet when the work is selected or when a product decision needs a durable place to land.

## Candidate Epics

| Epic | Description | Status |
| --- | --- | --- |
| E01 Harness Operations | Keep repository harness, product docs, story packets, validation matrix, and traces usable for team + agents | active |
| E02 Local Development Baseline | Make install, Docker infrastructure, client, and server smoke validation reliable | unsliced |
| E03 Restaurant Discovery UI/API | Search/list/detail restaurants with server-backed API and clear trust/price signals | unsliced |
| E04 Authentication & Identity | Cognito-backed login/session flow and protected actions | unsliced |
| E05 Review Submission | Create, store, display, and moderate food reviews | unsliced |
| E06 Anti-Fraud Verification | Receipt hash/OCR/timestamp/merchant/GPS verification pipeline | unsliced |
| E07 Trust Score & Badges | Compute trust scores and badges from verified behavior and fraud signals | unsliced |
| E08 AWS/LocalStack Integrations | Provider service boundaries, LocalStack support, and deployment-safe config | unsliced |
| E09 Observability & Audit | Request logs, audit records, verification evidence, and operational diagnostics | unsliced |

## Ready Story Packets

| Story | Title | Lane | Status | File |
| --- | --- | --- | --- | --- |
| TB-HARNESS-001 | Install and adopt repository harness | normal | implemented | `docs/stories/TB-HARNESS-001-install-repository-harness.md` |

## Suggested Next Slices

| Story | Title | Lane | Why |
| --- | --- | --- | --- |
| TB-DEV-001 | Establish local smoke validation | normal | Team needs a repeatable proof path before larger features |
| TB-API-001 | Mount API router and define response/error conventions | normal | Current server has health only and route mounting TODO |
| TB-FRAUD-002 | Extract and test Haversine proximity rule | normal/high-risk | Current logic is client simulation; rule should become backend-testable |
| TB-AUTH-001 | Define Cognito authentication contract | high-risk | Auth is a hard gate and needs product + security clarity before implementation |
