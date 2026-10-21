# Trove build status

Updated: 21 October 2026 (Asia/Kolkata).

## Current review checkpoint

Structured recipe data is implemented and locally verified on
`feat/structured-recipes`. Changes remain unstaged and uncommitted for user
review. The user handles all Git staging, commits, pushes, PRs, and merges.
No recipe UI, detail API, creation flow, save, fork, collection, deployment,
or production database work is included.

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

IMPLEMENTED and LOCALLY VERIFIED on `feat/structured-recipes`:

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
- Production migration is not applied. No deployment was performed.
- This feature is not committed, pushed, or merged. The next feature remains
  unapproved until this focused PR is reviewed and merged.
