# Harness

The project goal is to provide a reusable operating harness that lets humans and
agents turn a future product spec into safe, validated work.

The app is what users touch. The harness is what agents touch.

## Mental Model

```text
------------------+
| Human intent    |
+------------------+
         |
         v
+------------------+
| Feature intake   |
+------------------+
         |
         v
+------------------+
| Story packet     |
+------------------+
         |
         v
+------------------+
| Agent work loop  |
+------------------+
         |
         v
+------------------+
| Product delta    |
+------------------+
         |
         v
+------------------+
| Validation proof |
+------------------+
         |
         v
+------------------+
| Harness delta    |
+------------------+
         |
         v
+------------------+
| Next intent      |
+------------------+
```

Every task has two possible outputs:

1. Product delta: app code, tests, API shape, data model, or product docs.
2. Harness delta: docs, templates, validation expectations, backlog items, or
   decision records that make the next task easier.

## Harness v0 Scope

Harness v0 includes:

- Agent entrypoint.
- Empty product documentation structure.
- Feature intake and risk lanes.
- Story templates.
- Decision log template.
- Validation report template.
- Test matrix placeholder.
- Harness growth backlog.
- Durable layer: SQLite database and CLI for operational records.

Harness v0 deliberately excludes:

- A project-specific `SPEC.md`.
- Pre-sliced product domains.
- A locked application stack.
- App source scaffolding.
- Package scripts.
- Test runner config.
- CI workflows.

Those should arrive only when a selected story needs them.

## Durable Layer

Policy documents describe how to work. The durable layer stores what happened.

Operational data — intake classifications, story status, decision outcomes,
backlog items, and execution traces — lives in a SQLite database (`harness.db`)
managed by the Rust Harness CLI at `npm run harness -- ...`. Agents and humans
should use that binary for Harness work. The database is local to each project
instance and `.gitignore`d. The schema is version-controlled under
`scripts/schema/`.

This separation keeps policy docs stable and human-readable while giving agents
a structured, queryable record of operational state. It also prepares the
harness for future observability and automated evolution without adding more
markdown files.

## Team Setup and Local State

Each team member has a local Harness database. This is intentional.

Ignored local Harness files:

- `harness.db`
- `harness.db-wal`
- `harness.db-shm`
- `scripts/bin/harness-cli`
- `scripts/bin/harness-cli.exe`

Do not commit those files. SQLite databases create noisy merge conflicts, and
Harness binaries are platform-specific. Shared, reviewable Harness state should
be captured in version-controlled markdown and schema files instead:

- `docs/FEATURE_INTAKE.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`
- `docs/TEST_MATRIX.md`
- `docs/stories/**`
- `docs/decisions/**`
- `scripts/schema/**`

After cloning the repository, install or refresh the local Harness CLI from the pinned Harness installer revision below. Inspect the downloaded script before executing it.

```bash
# macOS/Linux
HARNESS_INSTALLER_REV=f07cd06db8f329cbe4009b730704d67ed8c3016e
curl -fsSLo /tmp/install-harness.sh "https://raw.githubusercontent.com/hoangnb24/repository-harness/${HARNESS_INSTALLER_REV}/scripts/install-harness.sh"
less /tmp/install-harness.sh
HARNESS_SOURCE_BASE_URL="https://raw.githubusercontent.com/hoangnb24/repository-harness/${HARNESS_INSTALLER_REV}" \
  bash /tmp/install-harness.sh --merge --yes
```

```powershell
# Windows PowerShell
$HarnessInstallerRev = "f07cd06db8f329cbe4009b730704d67ed8c3016e"
$Installer = "$env:TEMP\install-harness.ps1"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/hoangnb24/repository-harness/$HarnessInstallerRev/scripts/install-harness.ps1" -OutFile $Installer
Get-Content $Installer
$env:HARNESS_SOURCE_BASE_URL = "https://raw.githubusercontent.com/hoangnb24/repository-harness/$HarnessInstallerRev"
& $Installer -Merge -Yes
```

Initialize the database if it does not exist, then apply any schema migrations shipped by the refreshed Harness docs:

```bash
npm run harness -- init
npm run harness -- migrate
npm run harness -- --version
```

This repository currently pins `harness-cli-v0.1.10`. After a refresh, `npm run harness -- --version` should print `harness-cli 0.1.10`. If the version is older, reinstall the CLI from the pinned installer commands above or set `HARNESS_CLI_RELEASE_TAG=harness-cli-v0.1.10` before running the installer.

Common commands:

```bash
npm run harness -- intake  --type <type> --summary <text> --lane <lane>
npm run harness -- story   add --id <id> --title <text> --lane <lane>
npm run harness -- story   update --id <id> --status <status>
npm run harness -- story   update --id <id> --unit 1 --integration 1 --e2e 0 --platform 0
npm run harness -- story   verify <id>
npm run harness -- story   verify-all
npm run harness -- decision add --id <id> --title <text> --doc docs/decisions/<file>.md
npm run harness -- trace   --summary <text> --outcome <outcome>
npm run harness -- score-trace
npm run harness -- score-context <trace-id>
npm run harness -- audit
npm run harness -- propose
npm run harness -- query   matrix
npm run harness -- query   matrix --numeric
npm run harness -- query   backlog
npm run harness -- tool    check
npm run harness -- query   tools --summary
npm run harness -- query   tools --capability <name> --status present
npm run harness -- query   interventions
npm run harness -- query   stats
npm run harness -- --version
```

## Source Hierarchy

```text
User-provided spec or prompt
  input material for first buildout or future changes

docs/product/*
  current product contract derived from accepted input

docs/stories/*
  story-sized work packets and historical evidence

npm run harness -- query matrix
  behavior-to-proof control panel backed by the durable layer

docs/decisions/*
  why the contract changed
```

Before implementation, product docs describe intent. After implementation,
product docs plus executable tests become the living contract.

## Spec Lifecycle

Harness v0 starts without a tracked project spec. When the human provides a
specification, treat it as input material, not as a permanent operating manual.
Use it to populate product docs, story packets, architecture decisions, and
validation expectations during the first buildout.

After the specification has been decomposed, do not keep extending it as the
living product plan. Ongoing work should update the smaller product docs,
stories, durable proof records, and decision records.

Ongoing work should enter the harness as one of these input types:

- New spec: a project specification that needs to become product docs and
  initial story candidates.
- Spec slice: a selected behavior from the provided spec.
- Change request: a bounded behavior change, bug fix, or product refinement.
- New initiative: a larger product area that needs multiple stories.
- Maintenance request: dependency, architecture, performance, security, or
  operational work.
- Harness improvement: a process, template, proof, or agent-instruction change.

The spec-to-work loop is:

```text
human intent or supplied spec
  -> classify input type
  -> update or create product contract
  -> create story packet or initiative notes when needed
  -> define validation proof
  -> implement or document the blocker
  -> update product docs, stories, durable proof records, and decisions
  -> capture harness friction
```

Large product areas should use scoped initiative notes instead of a second
monolithic specification. An initiative should explain the goal, affected
product docs, candidate stories, validation shape, open decisions, and exit
criteria. If initiative work becomes a repeated pattern, add a template or
record the proposal with `npm run harness -- backlog add`.

## Growth Rule

The harness grows from friction.

When an agent is confused, repeats manual reasoning, needs a new validation
command, discovers a missing rule, or sees a recurring failure pattern, it must
either improve the harness directly or record the friction:

```bash
npm run harness -- backlog add --title "<short name>" --pain "<what was hard>"
```

Use the backlog outcome loop for improvements that are expected to change agent
behavior or validation results:

1. When creating the backlog item, fill `--predicted` with the measurable
   impact expected from the improvement.
2. When closing the item, fill `--outcome` with the actual measured result or
   review evidence.
3. Use `npm run harness -- query backlog --open` to review proposed and accepted
   items, and `npm run harness -- query backlog --closed` to compare predictions
   with outcomes after implementation.

The `harness_friction` field on traces also captures per-task friction so
patterns can be queried later:

```bash
npm run harness -- query friction
```

Backlog risk uses the same lane vocabulary as intake and stories:
`tiny`, `normal`, or `high-risk`. Use `--risk tiny` for low-risk follow-up
items; `low` is not a valid lane.

## Task Loop

For every task:

1. Classify the request with `docs/FEATURE_INTAKE.md`.
2. Record the classification with `npm run harness -- intake`.
3. Locate the affected product docs and story files.
4. Check proof status with `npm run harness -- query matrix`.
5. Work only inside the selected lane: tiny, normal, or high-risk.
6. Before finishing, ask whether product truth, validation expectations,
   architecture rules, repeated failure patterns, or next-agent instructions
   changed.
7. Record a trace with `npm run harness -- trace`, using
   `docs/TRACE_SPEC.md` for the expected trace tier and field depth.
8. Review the trace score printed by `npm run harness -- trace`; use
   `npm run harness -- score-trace --id <id>` only when re-checking a
   specific historical trace.
9. If harness friction was found, either fix it directly or record it with
   `npm run harness -- backlog add`.

## Tool Registry And Optional Capabilities

Harness v0.1.10 adds an inbound tool registry. Use it to record optional project tools and scan whether they are available on the current machine. A missing optional tool is a clean degrade path, not a Harness failure.

```bash
npm run harness -- tool register \
  --name deploy-check \
  --kind cli \
  --capability deploy-verification \
  --command ./scripts/deploy-check.sh \
  --description "Verify deploy health before release" \
  --responsibility Verification

npm run harness -- tool check
npm run harness -- query tools --capability deploy-verification --status present
```

Tool kinds are `cli`, `binary`, `mcp`, `skill`, and `http`. For `mcp`, `skill`, or `http`, pass `--scan <path-or-url>` so `tool check` can persist `present`, `missing`, or `unknown`. See `docs/TOOL_REGISTRY.md` for the degrade ladder and full command reference.

## Story Verification

Stories may carry a mechanical proof command:

```bash
npm run harness -- story add --id US-012 --title "Story verification" --lane normal --verify "cargo test --workspace"
npm run harness -- story update --id US-012 --verify "cargo test --workspace"
npm run harness -- story verify US-012
```

`story verify` runs the command from the repository root, records
`last_verified_at` and `last_verified_result`, and exits 0 on pass or 1 on fail.
When `trace --story <id>` links to a story whose verification command has never
passed, the trace still records but prints an advisory warning before close.

`story verify` accepts only the story id. Configure the command with
`story add --verify` or `story update --verify`. Record proof booleans with
`story update`, using numeric values: `1` means yes and `0` means no. The Rust
CLI rejects text values such as `yes` and `no`.

Use `npm run harness -- query matrix --numeric` when copying proof values
back into `story update`. The default matrix output is human-readable
`yes`/`no`; the numeric output mirrors CLI input.

## Decision Records

High-risk work needs durable decisions when it changes behavior or architecture.
For auth, authorization, data ownership, API shape, audit/security, or
validation changes, record the decision in both places:

1. Add a markdown file under `docs/decisions/` from
   `docs/templates/decision.md`.
2. Add or refresh the durable record:

```bash
npm run harness -- decision add \
  --id 0008-auth-boundary \
  --title "Auth Boundary" \
  --doc docs/decisions/0008-auth-boundary.md \
  --notes "Accepted during T4 authentication work."
```

The trace `--decisions` field is useful evidence, but it is not the decision
log. Do not treat decision text in a trace as satisfying the durable decision
record requirement.

## Harness Change Policy

Agents may update directly:

- Story status and evidence via `npm run harness -- story update`.
- Test matrix rows via `npm run harness -- story add` and
  `npm run harness -- story update`.
- Links from story packets to product docs.
- Validation notes and reports.
- Small clarifications tied to the current task.
- Intake records, traces, and backlog items via `npm run harness -- ...`.

Agents should ask for human confirmation before:

- Changing architecture direction.
- Removing validation requirements.
- Changing the source-of-truth hierarchy.
- Changing risk classification rules.
- Replacing the feature workflow.

## Done Definition

A task is done only when:

- The requested change is completed or the blocker is documented.
- Relevant docs, stories, and test matrix entries remain current.
- Validation commands were run when they exist.
- A trace has been recorded with `npm run harness -- trace`.
- Missing harness capabilities were recorded with
  `npm run harness -- backlog add`.
- The final response says what changed and what was not attempted.

## Future Validation Ladder

No validation scripts exist yet. When implementation begins, the expected ladder
is:

```text
validate:quick
  format, lint, typecheck, unit tests, architecture check

test:integration
  backend, database, provider, or service checks as the stack requires

test:e2e
  user-visible end-to-end flows

test:platform
  shell, mobile, desktop, or deployment smoke checks as the stack requires

test:release
  full suite, log checks, and performance smoke
```

Agents must not claim these commands pass until they exist and have been run.
