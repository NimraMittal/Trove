# Proposed PR

Title: Finish session-aware header and restore mobile navigation

Base: `main` — Head: `feat/auth-header`

Approved local commit:
`feat(nav): add accessible mobile navigation`

## Description

The shared header recognizes guest and authenticated sessions, offers retry
when account lookup fails, and retains the account state when logout cannot
be confirmed. On mobile, navigation previously disappeared below 760px.
Add a menu toggle with expanded-state semantics, Escape dismissal and focus
return, and link/route dismissal. Account actions remain visible below the
logo and menu row. Preserve the official logo and existing header styling.

No schema, cookie, proxy, authentication, or production configuration changes.
Collections remains unavailable until its feature is implemented.

## Files

Existing branch commits change the auth API client, auth header actions,
shared header/navigation and styles, and recipes layout. The current changes
update `PrimaryNav.tsx`, `SiteHeader.module.css`, `frontend/package.json`, add
`frontend/scripts/check-header.mjs`, and add these review/status documents.

## Validation

- Frontend: typecheck, zero-warning lint, production build.
- Backend: typecheck, all three existing auth tests, production build.
- Automated Chrome checks with intercepted auth responses: mobile menu,
  Escape/focus return, link dismissal, guest/authenticated UI, logout failure/success,
  account lookup failure/retry, and responsive widths from 320 to 1440px.
  Final run targets the production build served locally.

The browser fixtures are UI regression coverage. Real session persistence,
cookie clearing, and DB session revocation remain unverified; complete those
against a confirmed isolated local database before merging.

## Security and limitations

No tokens move into browser storage. Existing session hashing, HttpOnly
cookies, origin enforcement, and server authorization remain intact.
Logout UI changes only after backend success. No synthetic engagement data,
new services, database mutations, or production actions were introduced.
The browser test is restricted to HTTP loopback origins without credentials,
blocks external browser requests and unexpected auth calls, and intercepts
auth requests rather than using real accounts. Its synthetic fixture identity
contains no secrets or production credentials. Each run owns its temporary
profile and dynamic debugging port, uses bounded startup/command waits,
and closes Chrome and removes its profile on completion. No browser sandbox
disabling flags are used. The local frontend's server-side proxy configuration
is not changed by this script; use local configuration for these checks.

## Manual acceptance checks before merge

1. With an isolated local DB and local backend/proxy, register a test account,
   log in, visit Home and Recipes, refresh, and confirm the display name persists.
2. Log out and verify `/api/auth/me` returns 401 with the former session cookie.
3. Check guest navigation and logged-in controls on a mobile browser; use
   keyboard Tab, Enter, and Escape to operate the menu.
4. Simulate backend failure; verify Retry and failed logout feedback.

Status: local draft only; no GitHub PR number or URL has been created.
The six reviewed files are included in the approved local navigation commit.
Stopped at the next user review checkpoint. Pushing, PR creation, merging,
deployment, and the next feature remain unauthorized.

## Real session verification on Fedora (not yet run)

Use an already provisioned, isolated local development PostgreSQL database
whose existing Trove migrations are already applied. Check `backend/.env`
privately in your editor: `DATABASE_URL` must target that database, not Neon
or production. If this prerequisite is unavailable, stop and arrange local
database setup separately; these instructions do not apply migrations or
reset any data. Registration/login/logout below write test data to this
local database. Use a test-only account and password.

1. In terminal A, start the backend with the exact browser origin:

   ```bash
   cd /home/nimramittal/projects/Trove/backend
   NODE_ENV=development APP_ORIGIN=http://localhost:3001 PORT=3000 npm run dev
   ```

2. In terminal B, start the frontend with the local proxy target:

   ```bash
   cd /home/nimramittal/projects/Trove/frontend
   TROVE_API_URL=http://127.0.0.1:3000 npm run dev
   ```

   Ports 3000 and 3001 must be available. Restart any existing Trove server
   with these settings rather than accidentally testing a different process.

3. Open a fresh Chrome Incognito window at `http://localhost:3001`. Keep
   using `localhost` throughout; do not switch to `127.0.0.1` in the browser.
   Open DevTools → Network and enable Preserve log. Visit `/signup` to
   register a unique test email, display name, and password of 15–128
   characters (or use an existing local test account), then visit `/login`.
   Enter an incorrect password once: expect `POST /api/auth/login` → 401
   and visible feedback. Enter the correct password: expect 200, navigation
   to `/recipes`, and the test display name in the header.

4. In DevTools → Application → Storage → Cookies → `http://localhost:3001`,
   confirm `trove_session` exists with HttpOnly, SameSite=Lax, and Path=/.
   Secure is off for this development HTTP session; production cookies use
   a different name and require Secure. Refresh `/recipes`, then navigate
   Home → Recipes. The display name should remain, and `GET /api/auth/me`
   should return 200 for the same user. An error/Retry state here is a
   failure to investigate, not a passing session-persistence test.

5. Before logging out, copy the `trove_session` cookie value privately from
   DevTools. In terminal C run this Python standard-library script and paste
   the value at its hidden prompt. It verifies that the saved cookie works
   before logout, then replays the *same* cookie after logout to distinguish
   server revocation from browser cookie removal. No token is printed,
   placed in shell history, stored in a file, or passed on a process command
   line. Do not share the cookie, screenshots of it, or a Network HAR.

   ```bash
   python3 - <<'PY'
   from getpass import getpass
   from urllib.error import HTTPError
   from urllib.request import Request, build_opener, HTTPRedirectHandler, ProxyHandler

   class NoRedirects(HTTPRedirectHandler):
       def redirect_request(self, req, fp, code, msg, headers, newurl):
           return None

   token = getpass('Paste the LOCAL trove_session cookie value (hidden): ').strip()
   if len(token) != 64 or any(c not in '0123456789abcdef' for c in token):
       raise SystemExit('Expected the 64-character local session token value.')
   opener = build_opener(ProxyHandler({}), NoRedirects())

   def check(expected):
       request = Request('http://localhost:3001/api/auth/me', headers={
           'Cookie': 'trove_session=' + token,
           'Accept': 'application/json',
           'Cache-Control': 'no-cache',
       })
       try:
           with opener.open(request, timeout=10) as response:
               status = response.status
       except HTTPError as error:
           status = error.code
       print('Saved-cookie /me:', status, '(expected', str(expected) + ')')
       if status != expected:
           raise SystemExit('FAIL: stop and investigate the unexpected response.')

   check(200)
   print('Click Log out in the browser; confirm HTTP 204, then press Enter here:', flush=True)
   with open('/dev/tty') as terminal:
       terminal.readline()
   check(401)
   print('PASS: the formerly valid cookie is rejected after logout.')
   PY
   ```

6. While that script waits, click **Log out** in the browser. Confirm
   `POST /api/auth/logout` → 204, the cookie is removed, and the header shows
   Log in / Sign up. Refresh; `GET /api/auth/me` should return 401 and guest
   controls should persist. Return to terminal C and press Enter: the
   saved-cookie replay must return 401. If it returns 200, logout has not
   revoked that session. Clear the clipboard after this check.

7. Sign in again: expect a new cookie and 200 from `/api/auth/me`. At a mobile
   width, check menu opening, Home dismissal, Tab focus, Escape focus return,
   and visible account controls. Stop both development servers with Ctrl+C.
   Record actual results in the tracker; until performed, these checks remain
   pending. The Chrome fixture tests do not satisfy this integration checklist.

If login/logout returns 403, check that the page origin is exactly
`http://localhost:3001` and the backend was restarted with the matching
`APP_ORIGIN`. A 500, proxy error, or missing DB table is a failed setup/check;
do not use production credentials or reset the DB to work around it.
