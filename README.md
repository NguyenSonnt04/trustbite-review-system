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
- Node.js (v18+)
- Docker & Docker Compose
- Flutter SDK 3.4+ for mobile development

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
- **Postgres Database** on `localhost:5432` (Credentials: `trustbite_user` / `trustbite_secure_password`, Database: `trustbite_db`)
- **LocalStack Gateway** on `localhost:4566` (Simulating AWS S3, Cognito, SES, and Textract)
- **pgAdmin** on `http://localhost:5050` (Login: `admin@trustbite.com` / `admin_password`)

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

---

## Configuration Files

### Server Settings (`/server/.env`)
```env
PORT=5000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=trustbite_user
DATABASE_PASSWORD=bietthicunglamduoccaichogi
DATABASE_NAME=trustbite_db

AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=mock-key
AWS_SECRET_ACCESS_KEY=mock-secret
AWS_S3_BUCKET_NAME=trustbite-invoices
AWS_SES_SENDER_EMAIL=noreply@trustbite.com
```

### Client Settings (`/client/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_AWS_REGION=ap-southeast-1
```
