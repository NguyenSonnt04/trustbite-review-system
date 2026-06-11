# Exec Plan

## Status

Superseded by decision `0010-cognito-first-auth-boundary` and the TB-AUTH-001 Cognito contract story.

## Goal

Do not implement the old backend-issued JWT/refresh-session path as the default auth design.

## Scope

In scope:

- Mark the older backend-session slice as superseded.
- Point future auth work to Cognito-first docs and story packets.

Out of scope:

- Backend-issued access JWT/refresh-token/session implementation.
- `user_sessions.refresh_token_hash`-based auth ownership.
- Any migration that depends on the superseded backend-session model.

## Risk Classification

Risk flags:

- Auth.
- Public contracts.
- Weak proof.

Hard gates:

- Auth.

## Stop Conditions

Pause if this superseded packet is proposed as the active source of truth again without a new accepted decision.
