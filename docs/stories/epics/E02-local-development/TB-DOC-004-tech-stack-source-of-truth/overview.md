# Overview

## Current Behavior

`trustbite-docs/` still presents React Native and NestJS/Prisma as preferred target choices in several architecture documents, while the active task manager and repository baseline point to Flutter/Dart mobile, Next.js web/admin, and Node.js/Express API work.

## Target Behavior

Architecture and stack documents treat the task manager as the source of truth for MVP stack planning:

- Mobile: Flutter + Dart.
- Web/admin: Next.js.
- Backend: Node.js + Express native ES modules in the current monorepo.
- Data/infra: PostgreSQL + PostGIS, Redis + BullMQ, AWS RDS/S3/ECS/Textract/SMS-capable provider.

React Native, NestJS, Prisma, and broader TypeScript migrations remain future alternatives that require a separate story/decision before implementation.

## Affected Users

- Engineering team.
- Mobile developer.
- Frontend/admin developer.
- PM/BA/QA using the task manager to slice sprint work.

## Affected Product Docs

- `trustbite-docs/README.md`
- `trustbite-docs/AGENTS.md`
- `trustbite-docs/04_Software_Engineering/Tech_Stack_Specification.md`
- `trustbite-docs/04_Software_Engineering/Mobile_App_Architecture.md`
- `trustbite-docs/04_Software_Engineering/System_Architecture_Design.md`
- `trustbite-docs/00_Document_Control/Version_History.md`

## Non-Goals

- No application code migration.
- No API contract change.
- No database schema change.
- No change to P0/P1 feature priorities beyond stack wording.
