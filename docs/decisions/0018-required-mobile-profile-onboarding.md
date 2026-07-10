# 0018 Required Mobile Profile Onboarding

Date: 2026-07-11

## Status

Accepted

## Context

Email-first registration creates a local user with only a verified Cognito
subject. TrustBite needs a display name, date of birth, and phone number before
that user creates identity-bearing reviews.

## Decision

Express extends the existing profile boundary with `date_of_birth` and accepts
display name, date of birth, and phone number through `PATCH /api/v1/users/me`.
Phone is normalized and unique. Mobile checks the derived `profileComplete`
after authentication and session restoration, and requires completion before
entering Home.

Store date of birth, not numeric age. Derive completion from the three columns
rather than persisting a mutable completion flag.

## Consequences

- Existing users without a date of birth see onboarding on their next session.
- Restart cannot bypass incomplete onboarding.
- Date of birth follows the existing user deletion and retention lifecycle.
- Avatar stays optional and Cognito remains the only token issuer.

## Alternatives Considered

1. Store age as an integer. Rejected because it becomes stale.
2. Persist `profile_completed`. Rejected because it can diverge from fields.
3. Store profile data in Cognito. Rejected because business profile state
   belongs to PostgreSQL.
