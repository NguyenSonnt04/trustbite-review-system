# 0026 AWS Location Classic Provider Boundary

Date: 2026-07-16

## Status

Accepted

## Context

TrustBite needs mobile maps, place search, reverse geocoding, and routes. The
existing AWS account already contains an Esri map, Place Index, Route
Calculator, API key, and IAM actions for the classic Amazon Location APIs.
AWS now marks classic `CalculateRoute` as no longer current, but replacing the
provisioned resources is outside this implementation request.

## Decision

Use MapLibre with the scoped map API key for map rendering. Keep place and route
operations behind public read-only Express endpoints that use server IAM
credentials and the classic `@aws-sdk/client-location` commands. Normalize all
provider responses at the service boundary. Accept only `car`, `truck`, and
`walking` for the configured Esri calculator; classic bicycle/motorcycle modes
are Grab-only. Store no search, route, or device location data. Request
foreground location only.

## Amendment: Cost And Client Boundaries (2026-07-17)

Public search, reverse-geocode, and route endpoints remain unauthenticated but
share a configurable fixed-window quota keyed by Express's trusted client IP.
Provider execution is rejected before the controller when the quota is
exhausted. `LocationService` copies only the Place Index and Route Calculator
names into service state and never retains the mobile map API key.

Flutter uses separate clients: `LocationApi` owns provider-backed place and
route operations, while `RestaurantApi` owns TrustBite restaurant discovery.
This keeps provider and product-domain responsibilities independently mockable.

## Alternatives Considered

1. Call all AWS Location operations directly from Flutter. Rejected because it
   would broaden client credentials/permissions and provider coupling.
2. Re-provision against the newer AWS Places and Routes APIs now. Deferred to a
   migration story because the accepted resources and permissions are classic.
3. Proxy the map style and tiles through Express. Rejected because it adds
   latency and bandwidth while AWS API keys are designed for scoped map use.

## Consequences

Positive:

- AWS credentials stay server-only.
- Mobile consumes stable TrustBite DTOs.
- A future provider or AWS API migration is isolated to config/services.
- Paid provider calls receive an application-level cost guard.
- Mobile provider and restaurant clients can be tested independently.
Tradeoffs:


- The route adapter uses a legacy AWS operation and needs a future migration.
- The mobile map API key is observable in the app and must be resource/action,
  platform, and quota restricted in AWS.
- LocalStack support may be incomplete, so deterministic SDK adapter tests are
  the required local proof.
- The in-process quota applies per Express instance; horizontally scaled
  deployments still need a distributed or edge quota.
## Follow-Up


- Evaluate AWS Location Routes/Places v2 before the classic APIs are retired.
- Add a manually gated live-provider smoke and platform E2E test.
- Add a distributed/edge Location quota before multi-instance production scale.
