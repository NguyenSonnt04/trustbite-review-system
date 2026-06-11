# Overview

## Status

Retired by `docs/decisions/0010-cognito-first-auth-boundary.md`. Cognito owns authentication and OTP/MFA flows where configured. Do not implement this backend OTP flow as the default auth path unless a later accepted decision replaces Cognito.

## Current Behavior

Backend auth is a skeleton. Routes/controllers/services exist but do not request or verify OTP. Docker local infrastructure now includes PostgreSQL, Redis, and LocalStack; backend OTP code still needs to wire Redis before this story can be implemented.

## Target Behavior

Users can request a 6-digit OTP for a phone number and verify it within 120 seconds. Redis enforces request rate limits and temporary phone locks. PostgreSQL stores hashed OTP evidence in `otp_verifications`. Local/dev delivery uses a fake provider or safe message capture guarded by `OTP_CAPTURE_MODE=redis` and explicit `NODE_ENV` allowlist (`development`/`test`); staging/QA/production must not capture plaintext OTP codes.

## Affected Users

- Guest user requesting OTP.
- Existing user logging in.
- Backend/admin/security teams validating OTP abuse controls.

## Affected Product Docs

- `trustbite-docs/01_Product_Management/Product_Requirements_Document_PRD.md`
- `trustbite-docs/02_Business_Analysis/Business_Rules.md`
- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/04_Software_Engineering/openapi.yaml`
- `trustbite-docs/05_Security_Algorithms/Anti_Fraud_Specification.md`
- `docs/decisions/0008-otp-redis-sms-provider-strategy.md`

## Non-Goals

- No UI work.
- No production AWS SMS registration.
- No social login.
