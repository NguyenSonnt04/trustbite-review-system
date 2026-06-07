# Client Review Rules

Applies to `client/`.

## Stack

- Next.js App Router.
- React.
- JavaScript/JSX.
- CSS modules / vanilla CSS.
- Browser-safe config only.

## Frontend rules

- Do not import anything from `server/`.
- Do not expose server secrets or non-public env vars to browser code.
- Only `NEXT_PUBLIC_*` variables may be used in client-side runtime config.
- API calls should go through `client/src/services/` unless there is a clear reason not to.
- Keep UI simulation separate from backend trust decisions.
- Do not treat client-only receipt/GPS simulation as verified backend state.
- User-visible behavior changes should be reflected in relevant product/story docs.
- Preserve accessibility basics: semantic controls, labels, keyboard behavior, readable contrast, and useful error/loading states.
- For forms or upload flows, validate user input client-side for UX but do not rely on it as the only validation.
