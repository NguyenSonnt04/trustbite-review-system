# Validation

## Proof Strategy

Prove Redis-backed OTP limits, PostgreSQL OTP evidence, migration success, and local rollback behavior before marking implemented.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Phone validation, OTP format, hash verify, Redis key TTL calculations. |
| Integration | Request OTP creates DB row and Redis counters; 4th request in 10 minutes returns 429; wrong OTP locks after threshold; expired OTP rejected; Redis unavailable fails closed. |
| E2E | API smoke request/verify using local fake provider capture. |
| Platform | `docker compose` starts Redis and API can ping Redis. |
| Performance | Not required for first slice beyond Redis connectivity. |
| Logs/Audit | No OTP code, token, or full phone number in logs. |

## Fixtures

- Fake phone numbers using test ranges.
- Local fake SMS provider response.
- Seed `otp_purposes.LOGIN`.

## Commands

```text
npm run docker:up
npm run db:migrate
# Redis ping via container or app config smoke
# API smoke commands to be added during implementation
# DB insert/rollback SQL proof for otp_verifications
```

## Acceptance Evidence

TBD after implementation.
