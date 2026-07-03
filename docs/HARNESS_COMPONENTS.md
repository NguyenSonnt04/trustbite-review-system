# Harness Components

This taxonomy maps the current `repository-harness` repository to two
component frameworks used by Phase 2 and updated by Phase 3 active
observability work:

- Runtime Substrate responsibilities: the 11 responsibility areas the harness
  should cover.
- NexAU decomposition: the seven implementation surfaces that influence agent
  behavior.

Status values:

- **Covered**: the repository has an explicit file, command, or record for this
  responsibility.
- **Partial**: the repository has some support, but the support is incomplete,
  manual, or not yet measured.
- **Missing**: no meaningful support exists yet.

## Responsibility Map

| # | Responsibility | Status | Harness Files | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| 1 | Task specification | Covered | `AGENTS.md`, `docs/FEATURE_INTAKE.md`, `docs/templates/story.md`, `docs/templates/spec-intake.md`, `docs/templates/high-risk-story/*`, `docs/stories/*`, `intake` table, `story` table | Requests are classified by type and lane before implementation; normal and high-risk work have templates and durable story rows. | Keep story packets synchronized with future product docs. |
| 2 | Context selection | Covered | `AGENTS.md`, `docs/CONTEXT_RULES.md`, `docs/ARCHITECTURE.md`, `docs/decisions/*`, `docs/product/README.md` | Phase 2 adds phase-by-lane context rules and retrieval triggers while preserving the stable entry list in `AGENTS.md`. | Future automation could enforce context selection or measure over-reading. |
| 3 | Tool access | Covered | `npm run harness -- ...`, `scripts/README.md`, `docs/TOOL_REGISTRY.md`, `scripts/schema/003-tool-registry.sql`, `scripts/schema/005-tool-extensions.sql`, `tool` table | The Harness CLI exposes operational commands and a machine-readable tool manifest through `query tools`; external tools can be registered, scanned with `tool check`, and queried by capability/status. | Permission profiles and usage analytics remain future work. |
| 4 | Project memory | Covered | `docs/HARNESS.md`, `docs/decisions/*`, `docs/GLOSSARY.md`, `docs/HARNESS_BACKLOG.md`, `docs/stories/*`, `harness.db`, `decision`, `backlog`, and `trace` tables | Decisions, backlog, stories, and traces preserve durable knowledge across tasks. | Future work should add staleness checks and summarize old traces. |
| 5 | Task state | Covered | `npm run harness -- query matrix`, `docs/TEST_MATRIX.md`, `intake` table, `story` table, `trace` table | Durable records track intake, story status, proof columns, and task traces. | Add lifecycle checks so in-progress stories cannot be forgotten. |
| 6 | Observability | Partial | `docs/TRACE_SPEC.md`, `trace` table, `scripts/schema/004-intervention.sql`, `npm run harness -- trace`, `npm run harness -- intervention add`, `npm run harness -- score-trace`, `npm run harness -- query traces`, `npm run harness -- query friction`, `npm run harness -- query interventions`, `docs/HARNESS_MATURITY.md` | Traces are auto-scored when recorded, can be rescored by command, and can be reviewed with friction and intervention context. | No dashboard or benchmark ingestion exists in this repo. |
| 7 | Failure attribution | Partial | `docs/HARNESS_COMPONENTS.md`, `docs/TRACE_SPEC.md`, `docs/HARNESS_AUDIT.md`, `trace.errors`, `trace.harness_friction`, `intervention` table, `docs/HARNESS_BACKLOG.md`, `backlog` table, `npm run harness -- audit`, `npm run harness -- query friction`, `npm run harness -- query interventions` | Failures can be tied to files, components, friction, interventions, backlog proposals, and linked intake lane/type context. | Automated attribution from benchmark failures to harness components remains limited. |
| 8 | Verification | Covered | `docs/TEST_MATRIX.md`, `npm run harness -- query matrix`, `npm run harness -- story verify`, `npm run harness -- story verify-all`, `npm run harness -- trace`, `npm run harness -- score-trace`, `npm run harness -- score-context`, `story.verify_command`, `story.last_verified_result`, `.github/workflows/harness-cli-release.yml`, `docs/templates/validation-report.md` | Stories can store and run mechanical proof commands, traces warn when linked story verification has not passed, trace/context quality can be checked mechanically, and release workflow verifies Rust CLI releases. | Benchmark ingestion remains future work. |
| 9 | Permissions | Partial | `AGENTS.md`, `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, `docs/ARCHITECTURE.md`, installer conflict handling in `scripts/install-harness.sh` | Policy describes when agents may update docs and when to ask before architecture or workflow changes. | Permissions are instruction-level only; no enforced policy layer or command allowlist exists. |
| 10 | Entropy auditing | Covered | `docs/HARNESS_BACKLOG.md`, `docs/HARNESS_AUDIT.md`, `docs/IMPROVEMENT_PROTOCOL.md`, `backlog` table, `trace.harness_friction`, `npm run harness -- audit`, `npm run harness -- propose`, `docs/HARNESS_MATURITY.md` | Growth rule captures friction, audit detects durable-state drift, backlog items compare predicted impact to actual outcome, and proposal generation can create reviewable backlog items. | Automated repair remains future work. |
| 11 | Intervention recording | Partial | `trace` table, `docs/decisions/*`, `docs/stories/*`, `docs/HARNESS.md` | Traces and decisions can record actions, decisions, and outcomes. | Human interventions are not separated from normal agent actions, and there is no review-event schema. |

## NexAU Cross-Reference

| Component | Harness Equivalent | Status | Notes |
| --- | --- | --- | --- |
| System prompts | `AGENTS.md` plus Harness policy docs | Covered | `AGENTS.md` is the stable shim; `docs/HARNESS.md`, `docs/FEATURE_INTAKE.md`, and `docs/CONTEXT_RULES.md` carry evolving operating instructions. |
| Tool descriptions | `scripts/README.md`, `docs/HARNESS.md`, `docs/TRACE_SPEC.md`, `docs/TOOL_REGISTRY.md`, `npm run harness -- query tools` | Covered | Commands are documented in a standalone registry and exposed as compiled plus registered tool manifest entries. |
| Tool implementations | `npm run harness -- ...`, `scripts/bin/harness-cli*`, `scripts/schema/001-init.sql`, `scripts/schema/002-story-verify.sql`, `scripts/schema/003-tool-registry.sql`, `scripts/schema/004-intervention.sql`, `scripts/schema/005-tool-extensions.sql` | Covered | The Rust CLI is the primary durable-layer implementation and stable repo-local entrypoint; this app repo stores schema files and the local binary but not upstream Rust source. |
| Middleware | installer safety logic, feature intake workflow | Partial | The installer and intake process mediate work, but there is no runtime middleware enforcing policies. |
| Skills | `docs/templates/*`, `docs/FEATURE_INTAKE.md`, `docs/CONTEXT_RULES.md`, `docs/TRACE_SPEC.md` | Partial | Reusable procedures exist as markdown, not executable or installable agent skills. |
| Sub-agents | None in this repository | Missing | No delegated specialist agents or sub-agent protocols exist. |
| Long-term memory | `harness.db`, `docs/decisions/*`, `docs/stories/*`, `docs/HARNESS_BACKLOG.md`, `docs/GLOSSARY.md` | Covered | Durable records and markdown decisions preserve task history and project vocabulary. |

## File Inventory

Every tracked project file plus the Phase 2 input file is mapped to at least
one Runtime Substrate responsibility.

| File | Primary Responsibility | Secondary Responsibilities |
| --- | --- | --- |
| `AGENTS.md` | Context selection | Task specification, permissions |
| `CLAUDE.md` | Context selection | Tool access |
| `README.md` | Project setup | Harness install and refresh instructions |
| `docs/ARCHITECTURE.md` | Permissions | Context selection, task specification |
| `docs/CONTEXT_RULES.md` | Context selection | Permissions, task specification |
| `docs/FEATURE_INTAKE.md` | Task specification | Permissions, context selection |
| `docs/GLOSSARY.md` | Project memory | Context selection |
| `docs/HARNESS.md` | Task specification | Project memory, task state, permissions |
| `docs/HARNESS_AUDIT.md` | Entropy auditing | Verification, task state |
| `docs/HARNESS_BACKLOG.md` | Entropy auditing | Project memory, failure attribution |
| `docs/HARNESS_COMPONENTS.md` | Failure attribution | Observability, entropy auditing |
| `docs/HARNESS_MATURITY.md` | Entropy auditing | Observability, verification |
| `docs/IMPROVEMENT_PROTOCOL.md` | Entropy auditing | Failure attribution, permissions |
| `docs/README.md` | Project memory | Context selection |
| `docs/TEST_MATRIX.md` | Verification | Task state |
| `docs/TOOL_REGISTRY.md` | Tool access | Context selection, verification |
| `docs/TRACE_SPEC.md` | Observability | Failure attribution, intervention recording |
| `docs/decisions/*` | Project memory | Permissions, task specification |
| `docs/product/*` | Task specification | Project memory |
| `docs/stories/*` | Task specification | Verification, project memory |
| `docs/templates/*` | Task specification | Verification, project memory |
| `npm run harness -- ...` | Tool access | Task state, observability |
| `scripts/README.md` | Tool access | Context selection |
| `scripts/harness.mjs` | Tool access | Cross-platform command wrapper |
| `scripts/harness-cli-release-tag` | Tool access | Installer release pin |
| `scripts/schema/001-init.sql` | Task state | Observability, project memory |
| `scripts/schema/002-story-verify.sql` | Verification | Task state, project memory |
| `scripts/schema/003-tool-registry.sql` | Tool access | Project memory |
| `scripts/schema/004-intervention.sql` | Intervention recording | Failure attribution |
| `scripts/schema/005-tool-extensions.sql` | Tool access | Project memory |

## Coverage Summary

- Covered: 7/11 responsibilities.
- Partial: 4/11 responsibilities.
- Missing: 0/11 responsibilities.

Covered responsibilities:

- Task specification.
- Context selection.
- Tool access.
- Project memory.
- Task state.
- Verification.
- Entropy auditing.
Partial responsibilities:

- Observability.
- Failure attribution.
- Permissions.
- Intervention recording.

The current Harness update converts tool access and entropy auditing into
covered responsibilities with capability/status tool scanning and the
audit/proposal loop. Later phases should focus on benchmark ingestion,
component-level attribution, permission enforcement, intervention capture, and
tool usage analytics.
