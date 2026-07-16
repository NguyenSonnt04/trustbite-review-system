# Overview

## Current Behavior

The admin portal shows a locked user-management placeholder. Express supports audited suspend/reactivate operations for Cognito bearer-token clients, but the opaque admin web session is intentionally not accepted by business APIs. There are no admin list, detail, create, profile-update, or role-management contracts.

## Target Behavior

An authenticated administrator can manage users through a same-origin Next.js BFF. Express validates the opaque admin session on every operation, rechecks local account and role state, and applies server-side authorization.

- `ADMIN` and `SUPER_ADMIN` can list and inspect users with masked contact data.
- Both roles can pre-provision confirmed ordinary `USER` accounts through Cognito and create the matching local profile for the existing OTP/custom-auth flow.
- Both roles can edit non-role profile fields within target-tier rules.
- Existing suspend/reactivate rules remain unchanged and require an audit reason.
- Only `SUPER_ADMIN` can assign or remove admin roles.
- No delete action is exposed.

## Affected Users

- `ADMIN`.
- `SUPER_ADMIN`.
- TrustBite users whose profiles, status, or roles are managed.

## Affected Product Docs

- `docs/product/authentication.md`
- `docs/product/user-profiles.md`
- `trustbite-docs/02_Business_Analysis/Role_Permission_Matrix.md`
- `trustbite-docs/03_UX_UI/Admin_Portal_Screen_Specification.md`
- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/04_Software_Engineering/openapi.yaml`

## Non-Goals

- Hard delete, direct anonymization, or changes to account-deletion retention.
- Email editing after provisioning.
- Cognito group authorization.
- Admin management from the mobile app.
