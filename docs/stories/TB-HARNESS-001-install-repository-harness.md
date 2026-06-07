# TB-HARNESS-001 Install And Adopt Repository Harness

## Status

implemented

## Lane

normal

## Product Contract

The TrustBite repository has a full Harness setup for serious team and coding-agent usage. Agents and humans can classify work, find project-specific instructions, record stories/decisions/traces, and map behavior to validation evidence.

## Relevant Product Docs

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/HARNESS.md`
- `docs/FEATURE_INTAKE.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`
- `docs/TEST_MATRIX.md`
- `docs/product/README.md`

## Acceptance Criteria

- Harness operating docs and templates exist under `docs/`.
- Harness scripts/schema and CLI exist under `scripts/`.
- `AGENTS.md` contains TrustBite-specific instructions, risk gates, and validation guidance.
- `CLAUDE.md` imports core Harness context for Claude Code sessions.
- `.gitignore` excludes Harness durable database files and CLI binary artifacts.
- Harness durable database can be initialized, migrated, imported from brownfield markdown, and queried locally through a portable npm wrapper.
- Initial TrustBite backlog and test matrix identify known gaps without claiming unproven product behavior.

## Design Notes

- Commands: Harness CLI is available through `npm run harness -- <command>`.
- Queries: use `npm run harness -- query matrix`, `query decisions`, `query backlog`, `query traces`.
- API: none.
- Tables: Harness SQLite durable layer only; not product data.
- Domain rules: no product behavior implemented by this story.
- UI surfaces: none.

## Validation

When updating durable proof status, use numeric booleans:
`npm run harness -- story update --id TB-HARNESS-001 --unit 0 --integration 1 --e2e 0 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | Not applicable; docs/process install only |
| Integration | `npm run harness -- init`; `migrate`; `import brownfield`; `query matrix`; `story verify TB-HARNESS-001` |
| E2E | Not applicable |
| Platform | CLI binary runs in current Git Bash/Windows environment |
| Release | Git status review before commit |

## Harness Delta

- Added full upstream Harness structure.
- Customized project instructions, architecture, product entrypoint, story backlog, and test matrix for TrustBite.
- Created the first story packet so future agents have an example of serious usage.

## Evidence

Commands run during setup:

```bash
npm run harness -- init
npm run harness -- migrate
npm run harness -- import brownfield
npm run harness -- query matrix
npm run harness -- story verify TB-HARNESS-001
```

Observed results:

- Harness database created at `harness.db`.
- Schema version 2 applied.
- Brownfield import completed.
- Decisions imported from `docs/decisions/`.
