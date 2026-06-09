# TB-DEV-002 GitHub Actions CI And Security Baseline

## Status

implemented

## Lane

normal

## Product Contract

The TrustBite repository has a GitHub Actions baseline that validates pull requests before merge without deploying to AWS. The baseline must prove the currently available local build surfaces, run Harness matrix visibility, and add dependency/security scanning that does not require cloud deploy credentials.

## Relevant Product Docs

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_MATRIX.md`
- `docs/HARNESS.md`

## Acceptance Criteria

- A CI workflow exists under `.github/workflows/` and runs on pull requests and pushes to `main`.
- CI installs Node dependencies with npm cache support and runs the currently available checks without claiming unavailable backend proof.
- Client lint and build are included because `client/package.json` exposes `lint` and `build` scripts.
- Server dependency installation is included, but backend build/test proof is explicitly omitted until server scripts exist.
- Mobile tests run in a separate job after GitHub Actions installs Flutter, so Node/web CI and mobile proof remain separated.
- Harness matrix query runs in CI to expose current proof gaps.
- A security workflow exists for CodeQL and dependency review without AWS secrets or deploy permissions.
- Workflows use minimal permissions, concurrency controls, and avoid secret use on untrusted pull requests.

## Design Notes

- Commands:
  - `npm ci --prefix client`
  - `npm run lint --prefix client`
  - `npm run build --prefix client`
  - `npm ci --prefix server`
  - `npm run harness -- query matrix`
  - `flutter test` in the mobile job after `subosito/flutter-action` installs Flutter.
- Queries:
  - Harness matrix remains the source of truth for implemented/planned proof.
- API:
  - none.
- Tables:
  - Harness durable records only; no product database changes.
- Domain rules:
  - No product behavior changes.
- UI surfaces:
  - none.

## Validation

When updating durable proof status, use numeric booleans:
`npm run harness -- story update --id TB-DEV-002 --unit 0 --integration 1 --e2e 0 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | Not applicable; workflow/config baseline only. |
| Integration | Workflow YAML validates locally with available tooling and references current package scripts. |
| E2E | Not applicable until deployment or browser smoke is selected. |
| Platform | CI targets Ubuntu GitHub-hosted runners; optional mobile test branch handles absent Flutter. |
| Release | `npm run client:build`; workflow lint/static validation when tooling is available. |

## Harness Delta

- Adds a story packet for CI/security setup because this is selected maintenance work.
- Keeps AWS deployment deliberately out of scope until a future deploy story.

## Evidence

Commands run during setup:

```bash
bash .agents/skills/github-actions-validator/scripts/install_tools.sh
bash .agents/skills/github-actions-validator/scripts/validate_workflow.sh --lint-only .github/workflows/ci.yml
bash .agents/skills/github-actions-validator/scripts/validate_workflow.sh --lint-only .github/workflows/security.yml
npm ci --prefix client
npm ci --prefix server
npm run lint --prefix client
find server/src -name '*.js' -print0 | xargs -0 -n 1 node --check
npm run client:build
npm run harness -- story verify TB-DEV-002
npm run harness -- query matrix --numeric
```

Observed results:

- `ci.yml` actionlint validation passed.
- `security.yml` actionlint validation passed.
- Client dependency install completed; npm reported 2 moderate vulnerabilities in client dependencies.
- Server dependency install completed with 0 reported vulnerabilities.
- Client lint passed.
- Server source syntax check passed.
- Client production build passed after dependencies were installed.
- `npm run mobile:test` was attempted locally but failed because `flutter` is not installed on this machine; GitHub CI installs Flutter before running mobile tests in a separate job.
- Durable story row `TB-DEV-002` was added and marked implemented with integration/platform proof.
- Review fix: story wording was aligned with the actual workflow, where Flutter is installed in CI rather than pre-detected.
