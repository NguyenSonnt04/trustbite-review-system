# Validation

## Proof Strategy

Use static inspection plus a Node ESM import smoke test for every file under
`server/src/models`.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Not available; no server test harness exists yet. |
| Integration | Not run; no SQL migration or database persistence was changed. |
| E2E | Not applicable. |
| Platform | Node import smoke for all model files. |
| Performance | Not applicable. |
| Logs/Audit | Not applicable; no runtime behavior changed. |

## Fixtures

No fixtures required.

## Commands

```text
npm run harness -- query matrix
node -e "<import every server/src/models/*.js file>"
```

## Acceptance Evidence

- `npm run harness -- query matrix` failed because local
  `scripts/bin/harness-cli` is not installed.
- Node ESM import smoke passed for all model files:
  `Imported 54 model files`.
- Schema/model coverage check: 54 `CREATE TABLE` definitions and 54 model
  files under `server/src/models`.
- `git diff --check` passed with Windows line-ending warnings only.
