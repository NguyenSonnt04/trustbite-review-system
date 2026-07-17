# TB-MOBILE-REVIEW-AVATAR-001: Show Reviewer Avatars

## Lane

High-risk. This changes a public API and exposes optional profile media.

## Outcome

Public restaurant review cards show the reviewer's configured avatar. Reviews
without a usable avatar show a neutral default-person silhouette.

## Acceptance Criteria

- Public reviews return nullable `reviewerAvatarUrl`.
- Only TrustBite-owned avatar references receive short-lived signed read URLs.
- Deleted users, missing avatars, invalid references, and delivery failures
  return `reviewerAvatarUrl=null`.
- Public responses continue to omit user IDs, contact/auth fields, stored
  avatar references, receipt data, and other private profile data.
- Mobile renders a circular network avatar when available.
- Mobile renders the same neutral default-person silhouette for null and failed
  avatar images.
- Review trust state remains in the existing badge and is not encoded in the
  avatar.

## Validation

| Layer | Proof |
| --- | --- |
| Unit | Avatar signed-read resolver, public DTO privacy, mobile parser |
| Integration | Deleted-user avatar suppression on the public reviews API |
| E2E | Review card shows network avatar or default silhouette |
| Platform | Full Flutter tests and analyze |
| Release | Full server tests and syntax check |

## Decision

`docs/decisions/0028-public-reviewer-avatar-delivery.md`

## Evidence

- Focused backend avatar resolver, public DTO, deletion privacy, and mobile UI
  contracts passed.
- Full server suite: 562 passed, 4 provider tests skipped.
- Full mobile suite: 62 passed.
- Server syntax: 133 files passed.
- Flutter analyze: no issues.
