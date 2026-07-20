# User Profiles

## Product Contract

Cognito owns authentication. PostgreSQL owns the TrustBite profile attached to
the verified Cognito subject.

Mobile users must complete these fields before entering the signed-in product:

- `displayName`: the user's full display name, at most 120 characters after trim.
- `dateOfBirth`: a real calendar date in `YYYY-MM-DD`, between
  `1900-01-01` and the current date.
- `phoneNumber`: a unique E.164 number. Vietnamese ten-digit local numbers are
  normalized from `0xxxxxxxxx` to `+84xxxxxxxxx` by Express.

The trimmed `displayName` is public on the user's public restaurant reviews.
When an optional avatar is configured, public reviews may expose only a
short-lived backend-resolved `reviewerAvatarUrl`; the stored avatar reference is
never returned directly. Missing avatars use the mobile default-person
silhouette. Deleted users always receive the anonymous name and a null avatar.
Public review APIs never expose the associated user ID, email, phone number, or
Cognito subject. Deleted users are shown as `Người dùng TrustBite`.

TrustBite stores date of birth rather than numeric age because age changes over
time. `profileComplete` is derived by Express from the three required fields
and is not persisted as a second source of truth. Avatar remains optional.
PostgreSQL `DATE` values remain calendar-date strings in `YYYY-MM-DD` form at
the server database boundary and must not undergo timezone-sensitive JavaScript
`Date` conversion.

## API Contract

`GET /api/v1/users/me` returns the profile and derived completion state.
`PATCH /api/v1/users/me` accepts supported profile fields. Initial onboarding
submits all required fields together:

```json
{
  "displayName": "Nguyen Son",
  "dateOfBirth": "2004-11-20",
  "phoneNumber": "0395665937"
}
```

Invalid fields return `422 VALIDATION_ERROR`. A number assigned to another
user returns `409 PHONE_NUMBER_IN_USE`. Existing authentication, account
status, and active deletion-request guards remain unchanged.

## Admin Management

`ADMIN` and `SUPER_ADMIN` may read user lists/details and update display name,
date of birth, and phone number through the server-side admin BFF. List
responses mask phone numbers. `ADMIN` cannot modify a `SUPER_ADMIN`.

Only `SUPER_ADMIN` may change `USER`, `ADMIN`, or `SUPER_ADMIN` assignments.
Role changes require a 10-to-500-character reason, preserve the mandatory
`USER` role, cannot target the actor's own roles, and write audit evidence.
Account status changes continue to use the separate audited
suspend/reactivate contract. No admin delete action is available.

## Mobile Flow

1. Cognito authenticates and issues an access token.
2. Mobile loads `GET /users/me`.
3. When `profileComplete` is false, mobile opens required onboarding.
4. Mobile submits the three fields to `PATCH /users/me`.
5. Mobile enters Home only after Express returns `profileComplete: true`.
6. Relaunch with a valid Cognito session repeats the profile check, so restart
   cannot bypass interrupted onboarding.

After onboarding, mobile exposes authenticated profile editing for the same
allowlisted fields. Avatar changes request a signed upload URL, upload the exact
image bytes, then persist the returned allowlisted `avatarUrl` through
`PATCH /users/me`. Account deletion remains a backend request lifecycle;
mobile signs out after the request is accepted.

Date of birth and phone number are sensitive profile data. Do not include them
in operational logs or analytics payloads.
