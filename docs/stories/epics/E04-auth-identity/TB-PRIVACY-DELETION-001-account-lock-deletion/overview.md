# Overview

## Current Behavior

Product docs define in-app account deletion, a web deletion link/form, and account deletion request states. The backend does not yet implement the deletion request API, identity verification for web requests, session/push-token revocation, or the deletion/anonymization job.

## Target Behavior

Authenticated users can request account deletion from the app. If a grace period is configured, users can view the open request and cancel it before processing starts. Users who cannot access the app can submit a verified web deletion request. Accepted deletion requests revoke active sessions, move through explicit request states, and end with PII deleted or anonymized according to the data retention policy.

## Affected Users

- Authenticated users requesting account/data deletion.
- Users who cannot log in but need a public web deletion path.
- Support/privacy operators handling deletion requests.
- Release, Legal, and QA teams validating store-compliance gates.

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
- No full legal rewrite of public privacy policy or terms.
- No physical deletion of fraud/audit/legal-minimum records beyond the retention policy.
