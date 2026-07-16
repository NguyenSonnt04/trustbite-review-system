# Exec Plan

## Goal

Add an AWS Location Service provider boundary and a real Flutter discovery map
that can search places, show public restaurants in the visible viewport, and
render a route to a selected restaurant.

## Scope

In scope:

- Express configuration, provider service, validation controllers, and public
  read-only Location routes.
- Flutter runtime map configuration, foreground location permission, MapLibre
  rendering, place search, nearby restaurant loading, and route rendering.
- LocalStack service declaration and placeholder environment documentation.

Out of scope:

- Database or restaurant schema changes.
- Persisting searches, routes, or device locations.
- Background location access, navigation instructions, live rerouting, or
  production AWS infrastructure provisioning.
- Claiming LocalStack provider success if the pinned image does not implement
  the Amazon Location APIs.

## Risk Classification

Risk flags:

- External systems.
- Public contracts.
- Cross-platform.
- Existing behavior.
- Weak proof.
- Multi-domain.

Hard gates:

- External provider behavior.

## Work Phases

1. Document the API/provider and mobile runtime contract.
2. Add failing backend config, service, controller, and route tests.
3. Implement the smallest Express provider slice.
4. Add Flutter API/runtime contract tests and implement the map screen.
5. Add platform permissions, dependency locks, LocalStack declaration, and
   placeholder environment variables.
6. Run targeted unit, build, Flutter, and static secret-boundary checks.
7. Record Harness evidence without overstating live-provider proof.

## Stop Conditions

Pause for human confirmation if:

- A schema or persistence change becomes necessary.
- Background location collection is required.
- The accepted AWS resources must be replaced rather than consumed.
- Validation requirements need to be weakened.

