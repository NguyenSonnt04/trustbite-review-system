# Overview

## Current Behavior

Backend auth is a skeleton. Routes/controllers/services exist but do not request or verify OTP. Docker local infrastructure has PostgreSQL and LocalStack but not Redis.

## Target Behavior

Users can request a 6-digit OTP for a phone number and verify it within 120 seconds. Redis enforces request rate limits and temporary phone locks. PostgreSQL stores hashed OTP evidence in `otp_verifications`. Local/dev delivery uses a fake provider or safe message capture; production SMS is behind a provider abstraction.

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
