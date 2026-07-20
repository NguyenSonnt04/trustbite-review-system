# Exec Plan

## Goal

Add an administrator-only private S3 upload path that persists stable owned
references and signs display URLs for the existing public/mobile contract.

## Scope

In scope:

- Dedicated private restaurant-image S3 configuration and signed GET URL TTL.
- Authenticated, role-protected multipart upload API.
- Idempotency, validation, transaction, audit, and compensation behavior.
- Public list/detail and emulator proof.

Out of scope:

- Merchant authorization, branch media, galleries, deletion, and processing.

## Risk Classification

Risk flags:

- Authorization.
- Data persistence.
- Audit/security.
- External AWS provider.
- Public API contract.
- Existing mobile behavior.

Hard gates:

- Authorization.
- External provider behavior.
- Audit/security.

## Work Phases

1. Write contract and negative-path tests.
2. Add configuration and isolated storage adapter.
3. Add transactional image service, controller, middleware, and route.
4. Update API/product contracts and Harness records.
5. Run DB, server, provider-mock, and emulator verification.

## Stop Conditions

Pause for human confirmation if merchant access, public S3 ACLs, schema
changes, or weaker file validation become necessary.
