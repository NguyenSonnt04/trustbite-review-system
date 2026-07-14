# TB-MOBILE-REVIEW-001: Submit receipt and GPS verified reviews

## Lane

high-risk

## Target Behavior

Authenticated mobile users can open a restaurant, enter four ratings and a
comment, attach a receipt image, capture current GPS evidence, submit the
review, and view backend-owned verification status.

## Acceptance Criteria

- Guests must authenticate before entering the review flow.
- Receipt image, latitude, longitude, and positive GPS accuracy are required.
- Review creation remains private until backend verification succeeds.
- Failed, reference-only, and pending outcomes are never public.
- Mobile displays backend status without deriving trust locally.

## Non-Goals

- Web review UI.
- Admin moderation UI.
- Multiple receipt images or review media.
