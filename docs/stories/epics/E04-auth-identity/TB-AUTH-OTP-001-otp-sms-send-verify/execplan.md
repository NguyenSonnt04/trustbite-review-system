# Exec Plan

## Goal

Implement backend OTP SMS request/verify with Redis-backed abuse controls and PostgreSQL OTP evidence.

## Scope

In scope:

- `POST /api/v1/auth/otp/request`.
- `POST /api/v1/auth/otp/verify`.
- Redis local service/config for OTP rate-limit, failed attempts, temporary phone locks, and local/dev message capture guarded by `OTP_CAPTURE_MODE=redis` and `NODE_ENV` in `development`/`test`.
- Startup env validation for OTP capture: if `OTP_CAPTURE_MODE=redis` is set outside allowlisted `NODE_ENV` values (`development`/`test`), emit a clear `SECURITY_WARNING` and exit before serving traffic.
- PostgreSQL `otp_verifications` records with hashed OTP.
- Local fake SMS provider abstraction; production target documented as AWS End User Messaging SMS.

Out of scope:

- UI/mobile changes.
- Real AWS SMS delivery setup/registration.
- Cognito-owned custom auth.

## Risk Classification

Risk flags:

- Auth.
- Data model.
- Audit/security.
- External systems.
- Public contracts.
- Weak proof.

Hard gates:

- Auth.
- External provider behavior.

## Work Phases

1. Confirm docs and decision records.
2. Wire backend Redis config/client to the local `redis` docker-compose service, including startup env validation that fails closed when `OTP_CAPTURE_MODE=redis` is set outside `NODE_ENV=development|test`.
3. Implement service/controller/routes behind `/api/v1/auth`.
4. Validate Redis rate-limit/temp-lock behavior and unsafe OTP capture startup rejection.
5. Validate DB insert/rollback, migration, and required `otp_purposes.LOGIN` seed.
6. Update Harness evidence.

## Stop Conditions

Pause for human confirmation if:

- Real SMS provider credentials/registration are required.
- Redis fail-open behavior is requested.
- Schema fields beyond current migration are needed.
