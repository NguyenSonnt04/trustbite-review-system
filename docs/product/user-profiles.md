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

TrustBite stores date of birth rather than numeric age because age changes over
time. `profileComplete` is derived by Express from the three required fields
and is not persisted as a second source of truth. Avatar remains optional.

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

## Mobile Flow

1. Cognito authenticates and issues an access token.
2. Mobile loads `GET /users/me`.
3. When `profileComplete` is false, mobile opens required onboarding.
4. Mobile submits the three fields to `PATCH /users/me`.
5. Mobile enters Home only after Express returns `profileComplete: true`.
6. Relaunch with a valid Cognito session repeats the profile check, so restart
   cannot bypass interrupted onboarding.

Date of birth and phone number are sensitive profile data. Do not include them
in operational logs or analytics payloads.
