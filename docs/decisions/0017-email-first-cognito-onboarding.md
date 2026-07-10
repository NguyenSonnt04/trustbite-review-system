# 0017 Email-First Cognito Onboarding

Date: 2026-07-11

## Status

Accepted

## Context

The mobile app presents one email field but the existing implementation started
only Cognito custom authentication. Custom authentication challenges don't
create users, so a new email could complete Lambda triggers without receiving
tokens. Even after Cognito account confirmation, Express rejected the first
access token because no local `users` mapping existed and the schema required a
phone number that email-first onboarding doesn't collect.

## Decision

Mobile creates a Cognito user through `SignUp` for a new email, confirms the
email with Cognito's delivery code, and bootstraps the initial Cognito session
with a generated credential held only in process memory. Existing confirmed
emails use the configured Cognito custom-authentication challenge.

After Cognito access-token verification, Express transactionally provisions a
missing local active user from the verified Cognito `sub`. `users.phone_number`
is nullable for this email-first path. No client input can choose a local user
id or Cognito subject, and Express continues to issue no production tokens,
passwords, or OTPs.

## Alternatives Considered

1. Create users in a custom-auth Lambda. Rejected because Cognito custom auth
   can't issue a token for the initially missing user in the same challenge
   sequence.
2. Keep phone number required and synthesize a value from email. Rejected
   because it corrupts the semantic meaning and uniqueness of phone data.
3. Add an unauthenticated Express signup endpoint that creates Cognito users.
   Rejected because Cognito remains the signup/token owner and mobile can call
   its supported signup API directly.

## Consequences

Positive:

- New users can complete the email-first UI without manual Cognito console
  creation.
- The first verified Cognito session gets a local TrustBite profile safely.
- Existing phone-transition mappings continue to take precedence.

Tradeoffs:

- Cognito's password-required signup policy needs a temporary generated
  credential for the first session bootstrap.
- Email delivery and real custom-auth OTP delivery must be configured and
  smoke-tested in AWS before release.

## Follow-Up

- Completed manually on 2026-07-11: replaced the forced-answer diagnostic with
  random email OTP delivery through SES and verified existing-user login.
- Move the console-managed Lambda and IAM/SES configuration into repository
  infrastructure before release automation.
