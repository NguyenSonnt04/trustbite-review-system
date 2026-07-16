# TrustBite - Reliable Food Review Platform

TrustBite ("Trust in every bite") is an expression-based backend and React frontend platform designed to restore trust in food reviews using anti-fraud verification engines (Receipt OCR validation via AWS Textract, GPS coordinate validation via Haversine formula, and AWS Bedrock/Claude review summarization).

This repository contains the structured skeleton folders for development.

## Repository Structure

```text
/ (root)
├── client/              # Next.js Application (App Router, JS/JSX, Vanilla CSS)
│   └── src/
│       ├── app/         # Split-Screen Layout page & visual styles
│       ├── components/  # Reusable UI widgets
│       ├── config/      # Client configurations
│       ├── hooks/       # Custom React hooks (GPS locating helpers)
│       └── services/    # API clients (Cognito integrations, API helper)
│
├── server/              # Node.js + Express Backend Application (Native ESModules)
│   ├── src/
│   │   ├── config/      # App, DB (Postgres), and AWS settings
│   │   ├── controllers/ # Request handlers (auth, restaurant, review, aws)
│   │   ├── middlewares/ # Error handling and token checks
│   │   ├── models/      # Data entity interfaces (user, restaurant, review, badge, priceHistory)
│   │   ├── routes/      # Routing endpoints
│   │   ├── services/    # Business services (db connections, aws integrations, ocr matching, geo calculations)
│   │   ├── app.js       # Express config & middleware register
│   │   └── server.js    # Entrypoint booster
│   └── package.json     # Server package manager
│
├── mobile/              # Flutter/Dart Mobile Application
│   ├── lib/
│   │   ├── main.dart    # Flutter entrypoint
│   │   └── src/         # App, theme, and feature modules
│   ├── test/            # Flutter widget tests
│   └── pubspec.yaml     # Flutter package configuration
│
├── docker-compose.yml   # Infrastructure (Postgres trustbite_db & LocalStack simulator)
│   └── package.json     # Workspace execution scripts
└── .gitignore
```

---

## Local Development Setup

### 1. Requirements
- Node.js (v20.9+; CI and Docker images currently use Node.js 24)
- Docker & Docker Compose
- Flutter SDK 3.35+ with Dart 3.9+ for mobile development

### 2. Install Workspace Dependencies
Run this in the root directory:
```bash
npm run install:all
```

### 3. Spin Up Infrastructure Services (Postgres & LocalStack)
Start the local environment containing PostgreSQL and LocalStack AWS emulator:
```bash
npm run docker:up
```
This spawns:
- **Postgres Database** on `localhost:5432` by default (container port `5432`; Credentials: `trustbite_user` / `your-local-db-password`, Database: `trustbite_db`)
- **Redis** on `localhost:6379` for OTP rate limits, temporary locks, and local queue/cache workflows
- **LocalStack Gateway** on `localhost:4566` (local AWS simulation; the compose file pins `localstack/localstack:4.4.0` for unauthenticated community S3/SES/Secrets Manager/Textract smoke coverage)
- **pgAdmin** on `http://localhost:5050` (Login: `admin@trustbite.com` / `your-local-pgadmin-password`)

If another local PostgreSQL instance already owns port `5432`, keep the repository defaults unchanged and override only your local ignored env files:

```env
# .env at repository root, consumed by docker compose
POSTGRES_HOST_PORT=15432

# server/.env, consumed by the Express server and migration runner
DATABASE_PORT=15432
```

Apply the TrustBite PostgreSQL schema after the database is running:

```bash
npm run db:migrate
```

The migration runner applies SQL files from `server/migrations/` and records
applied versions in `schema_migrations`.

### 4. Run Development Servers
Start both client and server concurrently:
```bash
npm run dev
```
- **Next.js Client**: `http://localhost:3000` (Conforms to the 50-50 Split-Screen layout specified in **SRS Section 1.1**)
- **Express Server**: `http://localhost:5000`

Run the Flutter mobile app:
```bash
npm run mobile:pubget
npm run mobile:run
```

`npm run mobile:run` maps `AWS_REGION`, Cognito public identifiers, and the AWS
Location map name/API key from the ignored `server/.env` file into Flutter
`--dart-define` values. AWS access keys, secret access keys, database
credentials, Place Index/Route Calculator names, and other server-only settings
are never passed to the mobile process. Explicit `TRUSTBITE_*` environment
variables override the mapped values. Restrict the mobile map API key to the
intended map/action, apps or origins, and usage quotas in AWS.

If `mobile/android`, `mobile/ios`, `mobile/web`, or another Flutter platform runner folder is missing, generate runners first:
```bash
cd mobile
flutter create .
```

---

## TrustBite Product Documentation

Imported TrustBite product, UX, API, security, database, QA, compliance, and operations documentation lives in `trustbite-docs/`.

Those docs describe product contracts and target architecture references. Implementation status remains tracked through `docs/`, `docs/stories/`, and:

```bash
npm run harness -- query matrix
```

---

## Harness for Team Development

Harness docs and schemas are version-controlled, but each developer keeps a local Harness database and CLI binary.

Ignored local Harness files:

- `harness.db`, `harness.db-wal`, `harness.db-shm`
- `scripts/bin/harness-cli`, `scripts/bin/harness-cli.exe`

After cloning, install or refresh the Harness CLI from the pinned Harness installer revision below. Inspect the downloaded script before executing it.

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

Then initialize/query local Harness state and apply schema migrations from the refreshed docs:

```bash
npm run harness -- init
npm run harness -- migrate
npm run harness -- --version   # expected: harness-cli 0.1.10
npm run harness -- query matrix
npm run harness -- tool check
```

If `tool check` is unavailable or `--version` prints an older release, rerun the pinned installer above or set `HARNESS_CLI_RELEASE_TAG=harness-cli-v0.1.10` before installing. The v0.1.10 update includes `scripts/schema/005-tool-extensions.sql` for tool kind/capability/status fields.

Use `docs/`, `docs/stories/`, `docs/decisions/`, and `scripts/schema/` as the shared source of truth. Do not commit the local Harness DB or binary.

---

## Configuration Files

### Server Settings (`/server/.env`)
```env
PORT=5000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=trustbite_user
DATABASE_PASSWORD=your-local-db-password
DATABASE_NAME=trustbite_db

AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=mock-key
AWS_SECRET_ACCESS_KEY=mock-secret
AWS_S3_BUCKET_NAME=trustbite-invoices
AWS_SES_SENDER_EMAIL=noreply@trustbite.com
AWS_COGNITO_USER_POOL_ID=local-cognito-user-pool
AWS_COGNITO_CLIENT_ID=local-cognito-client
AWS_LOCATION_MAP_NAME=TrustBiteMap
AWS_LOCATION_PLACE_INDEX_NAME=TrustBitePlaceIndex
AWS_LOCATION_ROUTE_CALCULATOR_NAME=TrustBiteRouteCalculator
AWS_LOCATION_ACCESS_KEY_ID=
AWS_LOCATION_SECRET_ACCESS_KEY=
AWS_LOCATION_SESSION_TOKEN=
AWS_LOCATION_MAP_API_KEY=
AUTH_PHONE_FALLBACK_ENABLED=true
TRUSTBITE_TRUSTED_AUTH_HEADERS=true
TRUSTBITE_AVATAR_ALLOWED_HOSTS=cdn.trustbite.test
GPS_PROXIMITY_THRESHOLD_METERS=200
TRUST_PROXY=false
```

`TRUST_PROXY` controls Express `trust proxy`. Keep it `false` for direct/local
runs. Behind a reverse proxy or load balancer (Nginx, AWS ALB) set it so `req.ip`
is the real client IP used by the anti-fraud same-device signal (e.g. `TRUST_PROXY=1`
for a single proxy hop, or a subnet/keyword such as `10.0.0.0/8`). Do not set it to
`true` unless every upstream hop is trusted, since it makes `X-Forwarded-For`
spoofable.

`AUTH_PHONE_FALLBACK_ENABLED=true` is a local transition setting. Production-like environments default this fallback off and should opt in only after verified-phone backfill proof.

`TRUSTBITE_TRUSTED_AUTH_HEADERS=true` is for local development and mobile emulator smoke tests only. It enables the dev-only trusted-local auth path used when Cognito signup/login is not available locally. Keep it disabled in production.

If a temporary JWT fallback is ever needed for isolated test doubles, keep it out of the default runtime path and document the exception in a decision record.

### Client Settings (`/client/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_AWS_REGION=ap-southeast-1
```.
