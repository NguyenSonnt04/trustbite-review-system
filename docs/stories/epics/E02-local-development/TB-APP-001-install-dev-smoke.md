# TB-APP-001 Install And Dev Smoke

## Status

implemented

## Lane

normal

Reason: this is a maintenance/local-development slice that touches workspace validation and Harness evidence. It does not change auth, authorization, data model, provider behavior, or public API contracts.

## Product Contract

TrustBite contributors can install dependencies and rely on documented client/server development commands. The slice proves the current checkout has the expected workspace manifests, lockfiles, installed dependency folders, client/server dev scripts, and production/syntax build commands.

## Relevant Product Docs

- `README.md`
- `package.json`
- `client/package.json`
- `server/package.json`
- `docs/TEST_MATRIX.md`

## Acceptance Criteria

- Root, client, and server package manifests expose the documented install, dev, and build commands.
- Root, client, and server lockfiles exist so installs are reproducible from npm metadata.
- Local client and server dependency folders exist on the target machine after `npm run install:all`.
- `npm run client:build` passes.
- `npm run server:build` passes.
- Harness can run `npm run harness -- story verify TB-APP-001` through a configured verify command.

## Design Notes

- Commands: `npm run verify:tb-app-smoke`, `npm run client:build`, `npm run server:build`.
- Queries: `npm run harness -- query matrix`.
- API: none.
- Tables: none.
- Domain rules: none.
- UI surfaces: no user-facing UI behavior changes in this slice.

## Validation

When updating durable proof status, use numeric booleans:
`npm run harness -- story update --id TB-APP-001 --unit 0 --integration 1 --e2e 0 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | Not applicable; no domain rule changes. |
| Integration | `npm run verify:tb-app-smoke` checks workspace manifests/install artifacts and runs client/server build commands. |
| E2E | Not claimed; this slice does not run browser user flows. |
| Platform | Local checkout has lockfiles/dependency folders and the build commands run on this machine. |
| Release | Not claimed. |

## Harness Delta

- Add `verify:tb-app-smoke` so `TB-APP-001` has a mechanical proof command.
- Update the Harness durable row with the verify command and proof flags after green validation.

## Evidence

Red proof before implementation:

```text
npm run harness -- story verify TB-APP-001
error: story TB-APP-001 has no verify_command. Configure one with: harness-cli story update --id TB-APP-001 --verify "<command>"
```

Green proof on 2026-07-08:

```text
npm run verify:tb-app-smoke
```

Result: passed. The script confirmed root/client/server scripts and install artifacts, `npm run client:build` completed successfully with static routes `/` and `/_not-found`, and `npm run server:build` passed syntax checks for 103 files.

```text
npm run harness -- story verify TB-APP-001
```

Result: passed through the configured `npm run verify:tb-app-smoke` command.
