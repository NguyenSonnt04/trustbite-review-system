# Overview

## Current Behavior

Product docs define in-app account deletion, a web deletion link/form, and account deletion request states. This story is limited to the authenticated backend request lifecycle: create/read/cancel deletion requests, reject duplicate open requests, block the current profile mutation while a request is active, revoke local sessions/push tokens when the request is accepted, and write request/cancel lifecycle audit records. Deletion/anonymization processing, public web deletion, and mobile account-settings entrypoints remain separate stories.

## Target Behavior

Authenticated users can request account deletion from the app. If a grace period is configured, users can view the open request and cancel it before processing starts. Accepted deletion requests revoke active local sessions/push tokens, move through explicit request states, and hand off later deletion/anonymization to `TB-PRIVACY-RETENTION-JOB-001`.

## Affected Users

- Authenticated users requesting account/data deletion.
- Support/privacy operators who need durable request lifecycle evidence.
- QA teams validating the backend account deletion request lifecycle.

## Affected Product Docs

- `trustbite-docs/01_Product_Management/Product_Requirements_Document_PRD.md`
- `trustbite-docs/01_Product_Management/MVP_Scope.md`
- `trustbite-docs/02_Business_Analysis/Business_Rules.md`
- `trustbite-docs/02_Business_Analysis/State_Machines.md`
- `trustbite-docs/02_Business_Analysis/User_Stories_Backlog.md`
- `trustbite-docs/03_UX_UI/Mobile_Screen_Specification.md`
- `trustbite-docs/04_Software_Engineering/API_Specification.md`
- `trustbite-docs/04_Software_Engineering/openapi.yaml`
- `trustbite-docs/06_Database_Design/PostgreSQL_Database_Schema.md`
- `trustbite-docs/08_Compliance_and_Privacy/Data_Retention_Policy.md`
- `trustbite-docs/09_Operations_and_Maintenance/Store_Submission_Readiness_Checklist.md`

## Non-Goals

- No admin account suspension/reactivation; that is covered by `TB-USER-ACCOUNT-SUSPENSION-001`.
- No user-to-user block/unblock implementation.
- No public web deletion form implementation; that is tracked by `TB-PRIVACY-WEB-DELETION-001`.
- No mobile account-settings Delete Account UI; that is tracked by `TB-MOBILE-ACCOUNT-DELETION-001`.
- No deletion/anonymization processor, provider cleanup, object storage cleanup, trust-score recomputation, or review-summary invalidation; those belong to separate retention/trust-score stories.
- No full legal rewrite of public privacy policy or terms.
- No physical deletion of fraud/audit/legal-minimum records beyond the retention policy.
