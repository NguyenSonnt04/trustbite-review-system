# Execplan

## Objective

Align TrustBite documentation with the task manager tech stack before new implementation work starts.

## Steps

1. Mark the active MVP stack as Flutter/Dart mobile, Next.js web/admin, and Node.js/Express API.
2. Move React Native, NestJS, Prisma, and full TypeScript migration language into future/alternative wording.
3. Update architecture diagrams and module wording so they do not imply a NestJS implementation.
4. Add version-history evidence for the stack-source-of-truth sync.
5. Run text searches and markdown whitespace checks.

## Rollback

Revert the documentation patch if the team later decides the imported React Native/NestJS target should replace the task manager stack.

## Open Questions

- Whether backend JavaScript should remain the long-term language or migrate to TypeScript after the MVP baseline is stable.
- Whether the admin Next.js code should be converted to TypeScript in a separate story.
