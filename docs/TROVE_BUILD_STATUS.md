# Trove build status

Updated: 21 October 2026 (Asia/Kolkata).

## Current review checkpoint

Stopped for user review. Preserve all existing work and keep one focused
feature per PR. Follow: Inspect → Plan → Implement → Test → Review → Commit
→ Push → PR → User approval → Merge → Next feature.

The user approved final review, checks, and a local commit limited to the
six reviewed files. Local commit message: `feat(nav): add accessible mobile
navigation`. Existing commits remain unchanged. The proposed header PR is
drafted locally, not published; its GitHub number and URL are pending
publication approval. No GitHub tracker writes were made at this checkpoint.
Do not push, create the GitHub PR, merge, deploy, start another feature,
create another branch, or apply migrations without further approval.

## Milestone 0 — Authentication-aware header

IMPLEMENTED on `feat/auth-header`. Existing commits `3e51735` and `00c6074`
were preserved; the initial working tree was clean. Local `main` and cached
`origin/main` point to `00924c1` (PR #18). A connected GitHub search for
`repo:NimraMittal/Trove is:pr head:feat/auth-header` returned no PRs.
The remote refs have not been refreshed; current remote branch existence
and the latest main commit are not independently confirmed.

Existing code includes registration/login forms, Argon2 password hashing,
database sessions with hashed tokens, HttpOnly cookies, current-user and
logout endpoints, shared session-aware headers, and database-backed public
recipe discovery. These are implementation findings, not claims of complete
end-to-end verification. Discovery still has preview copy and basic cards.
Structured ingredients/instructions are not yet present in the Prisma schema.

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

PENDING VERIFICATION / REVIEW GATE:

- Full local register → login → refresh → current user → logout lifecycle,
  plus session invalidation against a confirmed isolated test PostgreSQL DB.
  No database connection strings or secrets were inspected, no DB writes
  were attempted, and no migrations were run in this task.
- Recipe-route browser/session navigation against the actual backend.
- Mobile visual review against the supplied reference and assistive-technology
  review; DOM/layout checks are not a complete accessibility audit.
- Confirm remote branch status and obtain permission before remote Git writes.

MERGED: not confirmed for this milestone. DEPLOYED: not performed or verified.
The approved local navigation commit includes the six reviewed files only;
see `git log` for its generated hash. No pushes, PR creation, merges, schema
changes, migrations, or deployments were performed. Review material and
Fedora session-testing instructions: `docs/AUTH_HEADER_PR.md`.

## Next milestone — Recipe foundation

Begin only after header review, merge, and explicit approval for the next
feature, per the requested workflow. Propose
structured ingredient and ordered instruction models with ownership,
visibility, deletion rules, and migration risks before requesting approval
for a migration. No migration is pending execution in this change.
