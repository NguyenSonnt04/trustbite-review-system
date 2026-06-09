# Validation

## Expected Proof

| Layer | Proof |
|---|---|
| Docs | `rg` confirms no remaining preferred-stack wording for React Native or NestJS in touched docs. |
| Whitespace | `git diff --check` passes. |
| Harness | `npm run harness -- query matrix` attempted before work; currently blocked because Harness CLI binary is missing. |

## Commands

```bash
npm run harness -- query matrix
rg -n "React Native|NestJS|Prisma|Flutter|Express" trustbite-docs README.md docs/ARCHITECTURE.md
git diff --check
```

## Notes

No application build is required because this story only changes planning and architecture documentation.
