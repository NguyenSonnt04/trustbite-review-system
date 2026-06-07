# Scripts

This directory contains harness automation tools.

## Harness CLI

The Rust Harness CLI is the primary interface for the durable layer. TrustBite uses a portable npm wrapper so the same command works across Git Bash, PowerShell, macOS, and Linux.

```bash
npm run harness -- init          # Create the database
npm run harness -- intake ...    # Record a feature intake classification
npm run harness -- story ...     # Add or update a story (test matrix row)
npm run harness -- story update --id US-001 --unit 1 --integration 1 --e2e 0 --platform 0
npm run harness -- story verify US-001  # Run the story's verify_command
npm run harness -- decision ...  # Add a decision or run its verification
npm run harness -- backlog ...   # Add or close a backlog item
npm run harness -- trace ...     # Record and auto-score an agent execution trace
npm run harness -- score-trace   # Score a trace against TRACE_SPEC.md tiers
npm run harness -- query ...     # Query harness data, including backlog --open/--closed
npm run harness -- query matrix --numeric  # Show proof flags as 1/0
npm run harness -- migrate       # Apply pending schema migrations
npm run harness -- --version     # Print the installed CLI version
```

Run `npm run harness -- help` or `npm run harness -- query help` for full usage. The wrapper delegates to `scripts/bin/harness-cli` or `scripts/bin/harness-cli.exe` when present.

Proof flags on `story update` are numeric booleans: use `1` for yes and `0` for
no. `story verify <id>` runs the configured `verify_command`; it does not accept
proof flags. Configure the command with `story add/update --verify`, run
`story verify <id>`, then update proof flags with `story update`.

Backlog `--risk` uses Harness lanes, not severity words: use `tiny`, `normal`,
or `high-risk`. Use `tiny` instead of `low`. `query matrix` defaults to
human-readable `yes`/`no`; use `query matrix --numeric` when copying values into
`story update`.

The schema lives in `scripts/schema/` and is version-controlled. The database
file (`harness.db`) is `.gitignore`d.

Requires: the prebuilt Rust CLI at `scripts/bin/harness-cli` or `scripts/bin/harness-cli.exe`.

Direct database inspection may still use SQLite tools, but normal Harness use should go through `npm run harness -- ...`.

### Rust CLI Commands

Current migrated commands:

```bash
npm run harness -- init
npm run harness -- migrate
npm run harness -- import brownfield
npm run harness -- intake ...
npm run harness -- story add ...
npm run harness -- story update ...
npm run harness -- story verify ...
npm run harness -- decision add ...
npm run harness -- decision verify ...
npm run harness -- backlog add ...
npm run harness -- backlog close ...
npm run harness -- trace ...
npm run harness -- score-trace
npm run harness -- query matrix
npm run harness -- query backlog
npm run harness -- query decisions
npm run harness -- query intakes
npm run harness -- query traces
npm run harness -- query friction
npm run harness -- query stats
npm run harness -- query sql ...
```

`npm run harness -- import brownfield` seeds or refreshes the durable database
from existing Harness v0 markdown in `docs/TEST_MATRIX.md`,
`docs/decisions/`, and `docs/HARNESS_BACKLOG.md`. This keeps already-installed
Harness repos on the Rust CLI path without losing their populated operating
docs.

## Installer

The upstream installer applies the Harness v0 operating files and folder
structure to a target project directory. It defaults to the current directory,
accepts a target path, and asks interactive users whether to `1. Merge`,
`2. Override`, or `3. Stop` when the target already contains `AGENTS.md`,
`docs/`, or `scripts/`.
Non-interactive installs stop on those protected paths unless `--merge` or
`--override` is provided. Use `--merge` as the safe update path for repositories
that already have Harness: it keeps existing files in place and creates only
missing Harness files. Add `--refresh-agent-shim` when an older install has the
full generated Harness guide in `AGENTS.md` and should move to the small stable
shim. Use `--override` only when replacing the protected Harness surface is
intentional.

```bash
curl -fsSL "https://raw.githubusercontent.com/hoangnb24/repository-harness/main/scripts/install-harness.sh?$(date +%s)" | bash -s -- --yes
```

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/hoangnb24/repository-harness/main/scripts/install-harness.ps1"))) -Yes
```

```bash
curl -fsSL "https://raw.githubusercontent.com/hoangnb24/repository-harness/main/scripts/install-harness.sh?$(date +%s)" | bash -s -- --merge --yes
```

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/hoangnb24/repository-harness/main/scripts/install-harness.ps1"))) -Merge -Yes
```

```bash
curl -fsSL "https://raw.githubusercontent.com/hoangnb24/repository-harness/main/scripts/install-harness.sh?$(date +%s)" | bash -s -- --merge --refresh-agent-shim --yes
```

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/hoangnb24/repository-harness/main/scripts/install-harness.ps1"))) -Merge -RefreshAgentShim -Yes
```

`--refresh-agent-shim` backs up `AGENTS.md` before changing it. If the existing
file is recognized as the old Harness-generated operating guide, the installer
replaces it with the current shim. Otherwise it appends or replaces only the
marked `<!-- HARNESS:BEGIN -->` block so project-specific instructions remain
in place.

The installer must stay limited to harness files. Do not use it to scaffold
application source folders, package scripts, CI, tests, platform shells, or fake
validation commands. The installer script is not part of the installed project
payload.

By default the installer also downloads the prebuilt Rust Harness CLI for the
current platform into `scripts/bin/harness-cli` on macOS/Linux or
`scripts/bin/harness-cli.exe` on Windows, then verifies its `.sha256` checksum.
A source branch can pin the release used by the installer through
`scripts/harness-cli-release-tag`; Phase 3 pins `harness-cli-v0.1.4` so branch
installs receive a Phase 3-built CLI. Set `HARNESS_CLI_RELEASE_TAG` to override
that tag, or set `HARNESS_CLI_BASE_URL` to point at an alternate artifact
directory, such as a local `file:///.../dist` directory created by
`scripts/build-harness-cli-release.sh`.

## Schema Migrations

Migration files live under `scripts/schema/` and are named `NNN-description.sql`
where `NNN` is a zero-padded version number. Run `scripts/bin/harness-cli migrate` to
apply pending migrations.

## Future Command Contract

Expected future checks:

```text
validate:quick
  format, lint, typecheck, unit tests, architecture check

test:integration
  backend contract and integration checks

test:e2e
  user-visible end-to-end flows

test:platform
  platform shell smoke checks, if the project has a native shell

test:release
  full suite, log checks, and performance smoke
```

## Release Packaging

Build the current-platform Rust CLI release artifact from the source repo:

```bash
scripts/build-harness-cli-release.sh
```

The script writes `dist/harness-cli-<platform>` plus `.sha256` checksums. The
Windows artifact includes the `.exe` suffix. Supported labels are:

- `macos-arm64`
- `macos-x64`
- `linux-x64`
- `linux-arm64`
- `windows-x64`

For cross-compilation, pass a Cargo target triple:

```bash
scripts/build-harness-cli-release.sh --target x86_64-unknown-linux-gnu
```

GitHub releases are produced by
`.github/workflows/harness-cli-release.yml`. Push a tag matching `v*` or
`harness-cli-v*` to run the verification job, build all supported targets on
native hosted runners, and upload these release assets:

- `harness-cli-macos-arm64`
- `harness-cli-macos-arm64.sha256`
- `harness-cli-macos-x64`
- `harness-cli-macos-x64.sha256`
- `harness-cli-linux-x64`
- `harness-cli-linux-x64.sha256`
- `harness-cli-linux-arm64`
- `harness-cli-linux-arm64.sha256`
- `harness-cli-windows-x64.exe`
- `harness-cli-windows-x64.exe.sha256`
