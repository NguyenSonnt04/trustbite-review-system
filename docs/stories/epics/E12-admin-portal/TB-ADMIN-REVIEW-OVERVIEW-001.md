# Admin Review Overview

## Status

implemented

## Lane

normal

## Product Contract

Administrators can open the review area, browse restaurants, select one restaurant, and inspect its public verified or reference-only user reviews without using fabricated client data.

## Relevant Product Docs

- `docs/product/reviews.md`
- `docs/ARCHITECTURE.md`

## Acceptance Criteria

- The review area lists active restaurants available through the existing admin restaurant API.
- Selecting a restaurant loads its public reviews from `GET /api/v1/restaurants/:restaurantId/reviews`.
- Reviews show reviewer identity, rating dimensions, comment, trust status, date, and reaction counts.
- Restaurant thumbnails retry once with a freshly signed URL when delivery fails and fall back to the restaurant initial instead of showing a broken image.
- Search, status filtering, restaurant pagination, review pagination, loading, error, and empty states are usable.
- The UI clearly states that private, rejected, hidden, deleted, and pending reviews remain unavailable until a dedicated admin moderation API exists.
- The layout remains usable on desktop and mobile widths.

## Design Notes

- Commands: `npm run lint --prefix client`, `npm run client:build`
- API: existing admin restaurant list and public restaurant review list only
- Domain rules: the client never infers or mutates review trust decisions
- UI surfaces: `client/src/components/admin/AdminReviewsSection.js`

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | No client unit runner is currently configured |
| Integration | Existing API contracts exercised through browser smoke |
| E2E | Admin selects restaurants, filters reviews, and paginates |
| Platform | Desktop and mobile browser smoke |
| Release | Client lint and production build |

## Harness Delta

Add a normal-lane story and record client validation evidence.

## Evidence

- `npm run lint --prefix client`: passed.
- `npm run client:build`: passed with `/admin` and existing BFF routes compiled.
- Scoped `git diff --check`: passed.
- Two-pass code review found a keyboard focus visibility issue and a restaurant-switch pagination issue; both were fixed, and the follow-up logic review returned no findings.
- Follow-up image diagnosis confirmed stored S3 references and freshly signed URLs return `200 image/jpeg`; the client now recovers from stale or failed image delivery with a bounded refresh and visible fallback.
- Authenticated browser smoke passed with real S3 images. Concurrent forced image failures showed accessible initial fallbacks, then both thumbnails recovered automatically after a background signed-URL refresh without resetting the review workspace.
- Follow-up review found and fixed queued-failure cooldown and accessible-name issues; the final independent review returned no findings.
- Authenticated browser smoke was not run because the isolated browser had no admin session and the desktop-control driver was unavailable. The unauthenticated `/admin` route correctly redirected to `/?reason=session_required` without browser console errors.
