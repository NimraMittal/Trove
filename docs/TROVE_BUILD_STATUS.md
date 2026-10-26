# Trove build status

Updated: 26 October 2026 (Asia/Kolkata).

## Current review checkpoint

Google authentication frontend integration is implemented and locally verified
with controlled browser fixtures on `feat/auth-google-ui`. Changes remain
unstaged and uncommitted for user review. The user handles all Git staging,
commits, pushes, PRs, and merges. Real Google account selection and local and
deployed end-to-end verification remain pending. Explicit account linking,
password recovery, and additional email verification remain separate features.

## Milestone 0 — Authentication-aware header

MERGED through PR #19. Local merge commit: `d78aa99`. Existing commits
`3e51735`, `00c6074`, and `45a2d0a` remain in history.

Existing code includes registration/login forms, Argon2 password hashing,
database sessions with hashed tokens, HttpOnly cookies, current-user and
logout endpoints, shared session-aware headers, and database-backed public
recipe discovery. Discovery still has preview copy and basic cards.

Changes in this review:

- Added a mobile navigation toggle; previously navigation disappeared below 760px.
- Added expanded/control semantics, Escape dismissal with focus return,
  link dismissal, route-change reset, and keyboard focus indicators.
- Kept account actions visible on a separate mobile row and preserved the
  approved logo at `frontend/public/branding/trove-logo.png`.
- Added a local Chrome regression script without new dependencies.
- Final test review removed the fixed debugger port, restricted the target
  to an HTTP loopback origin without credentials, blocked external browser
  requests and unexpected auth calls, added command/startup timeouts, and
  cleaned up the run's isolated Chrome profile. No hardcoded secrets or
  production credentials were found; the fixture identity is synthetic.

LOCALLY VERIFIED:

- Frontend TypeScript, ESLint with zero warnings, and production build.
- Backend TypeScript, three existing auth tests, and production build.
- Chrome header regression: guest and authenticated states; menu toggle;
  Escape/focus return and link dismissal; failed logout retains identity; successful logout
  displays guest actions; account failure and retry; no page overflow at
  320, 375, 768, and 1440 pixels.
- Browser checks intercept auth API requests with explicit test fixtures.
  They do not exercise Express, PostgreSQL, real cookies, or registration.

Run the frontend using `npm run dev`, then `npm run test:header` from
`frontend/`. Requires Node with global WebSocket support (verified on Node
24) and Chrome. Set `CHROME_BIN` to override `/usr/bin/google-chrome`;
`HEADER_TEST_URL` accepts an HTTP loopback origin only. Each run allocates
its own debugging port and fresh temporary profile, then closes Chrome
and removes that profile. No real accounts or database records are created.
Final browser checks run against the production build served locally.
Build/font downloads and Chrome/tsx sockets required execution outside the
restricted sandbox; successful results came from approved reruns.

The user reported completing real authentication testing and will report any
failures separately. The automated Chrome fixture test remains distinct from
that manual integration testing. DEPLOYED status was not verified here.

## Milestone 1 — Structured recipe data

MERGED through PR #20. Merge commit: `dd18ea4`. The user reports that the
Render backend successfully deployed that commit; the exact production
migration record remains pending build-log verification.

- Added recipe-owned ingredients with UUIDs, names, optional decimal
  quantities, optional units and notes, and zero-based positions.
- Added recipe-owned cooking steps with UUIDs, instruction text, and
  zero-based positions.
- Added compound uniqueness per recipe and database-enforced nonnegative
  position checks.
- Added cascade deletion from recipes to ingredients and steps while keeping
  User → Recipe `RESTRICT` and recipe visibility unchanged.
- Added a guarded local-database integration test with explicit, ID-scoped
  cleanup. It verifies ordering, nullable quantities, notes, uniqueness,
  nonnegative positions, cross-recipe position reuse, cascade deletion, and
  the unchanged public recipe summary response.

Migration `20261021163746_add_structured_recipe_data` was inspected before
application and applied only to local `127.0.0.1:5432/trove_development`.
It creates two tables, two compound unique indexes, two check constraints,
and two cascade foreign keys. It contains no recipe updates or deletions.
Recipe count was 4 before and 4 after migration and testing. All four
migrations are applied locally with none rolled back.

Verification passed:

- Prisma format and validation.
- Prisma Client generation using the existing Prisma 7 configuration.
- Backend TypeScript typecheck and production build.
- Three existing authentication tests.
- Two structured-recipe schema/API integration tests.
- Prisma migration status reports the local database is up to date.

LIMITATIONS / PENDING:

- Existing recipes have empty ingredient and step relations because no
  honest legacy source exists for backfill.
- PostgreSQL check constraints live in customized migration SQL because
  Prisma Schema Language does not represent them.
- The production migration record has not been independently confirmed from
  Render build logs.

## Milestone 2 — Password visibility and authentication form UX

MERGED through PR #21. Merge commit: `abb09d2`.

- Added a reusable password field with an inline eye control, hidden-by-default
  values, stable spacing, and visible pointer and keyboard focus states.
- Added password visibility controls to login, signup password, and signup
  confirmation fields. Controls expose changing Show/Hide labels,
  `aria-controls`, and pressed state without changing input values.
- Added frontend-only password confirmation with an announced inline mismatch
  error and focus movement to the invalid confirmation field.
- Kept the registration API contract unchanged. Confirm Password has no form
  name and is absent from the JSON request sent to Express.
- Preserved `current-password` and `new-password` autocomplete values and the
  existing login, registration, and redirect flows.

Verification passed:

- Frontend TypeScript typecheck.
- Frontend ESLint with zero warnings.
- Frontend production build.
- Local Chrome regression against the production build: pointer and keyboard
  visibility toggles, retained values, autocomplete/name semantics, login
  failure and retry, success redirects, mismatch blocking and announcement,
  exact registration payload, and layouts at 320, 768, and 1440 pixels.
- Visual review of the signup form at desktop and mobile widths.

The Chrome regression intercepts authentication requests with explicit test
fixtures. It does not exercise Express, PostgreSQL, real cookies, password
hashing, or a deployed environment. No real browser/backend authentication
test was run for this frontend-only change.

## Milestone 3 — Google authentication backend foundation

MERGED through PR #22. Merge commit: `780e568`.

- Added provider identities keyed by the verified Google `sub`, with unique
  provider/subject and user/provider constraints and cascade deletion.
- Added official Google ID-token verification with an exact web-client
  audience and controlled handling for invalid credentials.
- Limited automatic user creation to verified Gmail identities and verified
  Google Workspace identities with an `hd` claim.
- Rejected existing-email collisions without silently linking accounts.
- Reused Trove's hashed database sessions and existing HttpOnly cookie policy.
- Added origin, strict JSON, body-size, token-size, and rate-limit protections.
- Kept email/password registration, login, current-user, and logout behavior.

Local migration `20261025132155_add_google_auth_identities` was generated with
`--create-only`, inspected, and applied only to
`127.0.0.1:5432/trove_development`. It creates one enum, one table, two unique
indexes, and one cascade foreign key. It contains no updates or deletes.
Existing counts were preserved by the migration: 6 users, 5 password
credentials, 9 sessions, and 4 recipes. The new identity table started empty.

Verification covers mocked Google verifier outcomes, local database identity
creation and concurrency, session hashing, cookie attributes, request origin
and validation, controlled collisions, database uniqueness/cascade behavior,
and password login/session revocation regression. No real Google sign-in has
been run. Production needs `GOOGLE_WEB_CLIENT_ID` before the endpoint can be
used; account linking and the frontend Google button remain future PRs.

Final checks passed: Prisma validation, Prisma Client generation, backend
typecheck and build, 3 existing authentication tests, 22 Google authentication
tests, 2 recipe schema/discovery regression tests, and migration status. Test
cleanup restored the same local counts and left 0 provider identities.

DEPENDENCY FOLLOW-UP:

- `npm audit --omit=dev` reports 8 existing transitive/direct dependency
  advisories (6 high, 2 moderate) through Express/body-parser,
  express-rate-limit, Prisma, and Zod. `google-auth-library` is not in any
  reported vulnerable path. The dry-run remediation changes several existing
  packages together, so it belongs in a focused dependency-maintenance PR.

## Milestone 4 — Google authentication frontend

IMPLEMENTED and MOCK-VERIFIED on `feat/auth-google-ui`:

- Added one reusable Google authentication section to login and signup with a
  stable `or` divider and responsive official GIS-rendered button.
- Loaded `https://accounts.google.com/gsi/client` through Next.js Script only
  on auth pages and configured callback popup mode with One Tap and automatic
  account selection disabled.
- Sent only the returned credential to `POST /api/auth/google`, validated the
  success response, reused the existing `/recipes` redirect and session-aware
  header, and did not decode or store the Google token in browser storage.
- Added controlled messages for invalid/rejected/ineligible/collision,
  rate-limit, unavailable, network, and malformed-response outcomes. Existing
  email/password forms and account-linking policy remain unchanged.
- Added Google Cloud, local, Vercel, Render, CSP/COOP, and manual end-to-end
  setup guidance in `docs/GOOGLE_AUTH_FRONTEND.md`.

Local verification passed:

- Frontend TypeScript typecheck.
- Frontend ESLint with zero warnings.
- Frontend production build using Next.js 16.3.5.
- Existing password-form and session-aware-header Chrome regressions.
- New mocked GIS Chrome regression: script failure/recovery, single
  initialization, popup/no-One-Tap configuration, cancellation, all documented
  API statuses, network and malformed-success handling, duplicate suppression,
  keyboard operation, exact request body, no browser token storage, mocked
  login/refresh/logout/revocation, and 320/768/1440-pixel layouts.

The browser regression intercepts the GIS library and authentication API with
synthetic fixtures. It does not contact Google or Express and does not verify
real ID-token signatures, PostgreSQL sessions, HttpOnly cookies, or deployed
configuration. Local frontend/backend Google client ID keys are present,
well-formed, and match, without exposing their values. A non-interactive Chrome
check loaded the live GIS script and rendered Google's iframe on
`http://localhost:3001`; it did not select an account or send a credential. A
real Google account flow and deployed Vercel → Render flow are still required
before calling the feature production-ready.
