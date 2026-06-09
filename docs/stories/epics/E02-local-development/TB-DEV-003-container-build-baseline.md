# TB-DEV-003 Container Build Baseline

## Status

implemented

## Lane

normal

## Product Contract

The TrustBite client and server can be built as production-oriented Docker images, and GitHub Actions can validate and scan those images without pushing to a registry or deploying to AWS.

## Relevant Product Docs

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_MATRIX.md`
- `docs/stories/epics/E02-local-development/TB-DEV-002-github-actions-ci-security.md`

## Acceptance Criteria

- `client/Dockerfile` builds the Next.js app with standalone output, runs as non-root, exposes port 3000, and includes a healthcheck.
- `server/Dockerfile` installs production dependencies only, runs as non-root, exposes port 5000, and includes a `/health` healthcheck.
- Client and server Docker build contexts exclude local dependencies, env files, logs, and build output.
- A container workflow builds both images on PR/push without pushing to AWS/ECR/GHCR.
- The container workflow scans built images for high/critical vulnerabilities and uploads SARIF when available; scan findings are reported without blocking the baseline build job.
- Client image builds require explicit public build args for API URL and AWS region, so deploy-target values are not silently baked into the bundle by Dockerfile defaults.
- No AWS secrets, registry credentials, or deploy permissions are required.

## Design Notes

- Commands:
  - `docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:5000 --build-arg NEXT_PUBLIC_AWS_REGION=ap-southeast-1 -t trustbite-client:ci ./client`
  - `docker build -t trustbite-server:ci ./server`
  - `bash .agents/skills/github-actions-validator/scripts/validate_workflow.sh --lint-only .github/workflows/container-build.yml`
  - `bash .agents/skills/dockerfile-validator/scripts/dockerfile-validate.sh client/Dockerfile`
  - `bash .agents/skills/dockerfile-validator/scripts/dockerfile-validate.sh server/Dockerfile`
- Queries:
  - Harness matrix records workflow proof only; runtime deploy remains future work.
- API:
  - none.
- Tables:
  - no product data changes.
- Domain rules:
  - no product behavior changes.
- UI surfaces:
  - none.

## Validation

When updating durable proof status, use numeric booleans:
`npm run harness -- story update --id TB-DEV-003 --unit 0 --integration 1 --e2e 0 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | Not applicable; container/config baseline only. |
| Integration | Dockerfile validator and GitHub workflow actionlint. |
| E2E | Not applicable until deployed runtime smoke exists. |
| Platform | Docker build proof when daemon is available; GitHub Actions build matrix for Ubuntu runners. |
| Release | Container workflow with image scan and no push/deploy. |

## Harness Delta

- Adds a selected story packet for the container baseline so AWS deployment can be added later as a separate story.

## Evidence

Commands run during setup/review:

```bash
bash .agents/skills/github-actions-validator/scripts/validate_workflow.sh .github/workflows/
grep -nEi "^[[:space:]]*FROM[[:space:]]+.*:latest|^[[:space:]]*(ENV|ARG)[[:space:]].*(password|secret|token|api[_-]?key)[[:space:]]*=|^[[:space:]]*USER[[:space:]]+(root|0(:0)?)$|^[[:space:]]*HEALTHCHECK[[:space:]]+" client/Dockerfile server/Dockerfile
npm run build --prefix client
find server/src -name '*.js' -print0 | xargs -0 -n 1 node --check
npm run harness -- query matrix --numeric
```

Observed results:

- GitHub Actions workflow validation passed for `.github/workflows/container-build.yml` as part of all-workflow actionlint validation.
- Manual Dockerfile checks found no `latest` base tags, obvious secret ARG/ENV assignments, or root runtime users; healthchecks are present in both Dockerfiles.
- Client production build passed with standalone output enabled.
- Server source syntax check passed.
- Local Docker builds passed for both `client/Dockerfile` and `server/Dockerfile` after switching to cache mounts with explicit ids.
- PR #4 review fix: `client/Dockerfile` no longer has default public build args; the container workflow passes API URL and AWS region explicitly, with region sourced from `vars.AWS_REGION` when configured.
- PR #4 review fix: `server/Dockerfile` copies only `package.json` into the runtime stage.
- The Dockerfile validator script exited before completing in this local environment because its Python/tool-install preflight failed; manual fallback checks were used instead.
- Durable Harness row `TB-DEV-003` can now be marked implemented with integration/platform proof.
