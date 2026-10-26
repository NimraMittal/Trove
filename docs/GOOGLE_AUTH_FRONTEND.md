# Google authentication frontend

Trove loads the official Google Identity Services library only on the login
and signup pages. The official button uses JavaScript callback and popup mode.
The browser sends the returned ID token to `POST /api/auth/google`; Express
verifies it and creates Trove's normal database-backed session. The frontend
does not decode, log, display, or persist the Google credential.

## Google Cloud setup

1. Open **Google Auth Platform → Branding** in the Google Cloud console.
   Configure the application name as Trove, a support email, the official logo,
   and production homepage and privacy-policy links on a domain you control.
2. On **Data Access**, keep only the basic identity scopes needed by Sign in
   with Google: `openid`, `email`, and `profile`. Trove does not request Google
   API access in this feature.
3. On **Audience**, choose the audience appropriate for the app. While an
   external app is in testing, add the accounts that will perform acceptance
   testing if the console requires them. Google documents an exception to the
   test-user restriction for Sign in with Google/basic identity scopes, but a
   Workspace administrator or account policy can still block access.
4. On **Clients**, create or select an OAuth client whose application type is
   **Web application**.
5. Add each browser origin exactly, with its scheme and port and without a path:

   ```text
   http://localhost
   http://localhost:3001
   http://127.0.0.1:3001
   https://trove-xi.vercel.app
   ```

   Only add origins actually used for development or production. Vercel preview
   URLs need individual authorized origins if they will be used for Google
   authentication; Google OAuth origins do not support wildcard hosts. This
   callback integration does not require an authorized redirect URI.
6. Copy the Web application **client ID**. Trove does not need or use a Google
   client secret for this ID-token callback flow.

Google's current setup reference is
[Get your Google API client ID](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid),
and the implementation follows the
[Google Identity Services JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference).

Google recommends separate Cloud projects and clients for development and
production. If separate clients are used, configure the matching frontend and
backend IDs in each environment.

## Environment configuration

For local development, use the same Web client ID on both applications:

```dotenv
# frontend/.env.local
NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com

# backend/.env
GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

Keep these local files untracked. `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` is a public
browser identifier and is embedded during `next build`; changing it requires a
new frontend build. It must still remain environment-specific and must match
the backend audience exactly.

In Vercel, add `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` to the intended Production
environment and any Preview environment used for acceptance testing, then
redeploy the frontend. In Render, add the same value as
`GOOGLE_WEB_CLIENT_ID` and redeploy the backend. Keep the existing backend
`APP_ORIGIN` equal to the exact frontend origin. Never add either local env
file or a Google credential returned to a browser to Git.

## Browser policy checks

The repository does not currently set a Content Security Policy or
Cross-Origin-Opener-Policy. If either is added at Vercel or in Next.js, allow
the GIS resources documented by Google:

- `script-src`: `https://accounts.google.com/gsi/client`
- `frame-src` and `connect-src`: `https://accounts.google.com/gsi/`
- `style-src`: `https://accounts.google.com/gsi/style`

When FedCM is unavailable or disabled, verify that the COOP policy permits the
Google popup, including `same-origin-allow-popups`; an incompatible COOP header
can produce a blank popup. Keep a suitable referrer policy for the cross-origin
GIS script. Test the final headers in the deployed environment instead of
adding speculative policy changes in this feature.

## Verification

Run the frontend and its mocked browser regression:

```bash
cd frontend
npm run dev
npm run test:google-auth
```

The regression replaces the remote GIS script with a local synthetic fixture
and intercepts auth requests. It covers script failure, initialization, no One
Tap or automatic selection, cancellation, keyboard use, duplicate callback
suppression, backend status mapping, malformed success, redirect, mocked
session refresh/logout/revocation, and responsive layout. It does not verify a
Google signature, Express, PostgreSQL, browser cookies, or Google Cloud setup.

Before production release, manually verify both a new eligible Google account
and a returning Google identity:

1. Start the real frontend and backend with matching client IDs.
2. Open `/login`, select **Continue with Google**, and complete account choice.
3. Confirm the browser posts only `{ "credential": "…" }` to
   `/api/auth/google`, receives a successful response and HttpOnly session
   cookie, and reaches `/recipes`.
4. Confirm `/api/auth/me` returns the user, then refresh `/recipes` and confirm
   the session remains active.
5. Log out and confirm `/api/auth/me` returns `401` afterward.
6. Repeat the entry flow from `/signup`.
7. Verify an existing password-account email gets the controlled instruction
   to use its existing sign-in method. Account linking is a separate feature.
8. Repeat the full flow on `https://trove-xi.vercel.app` after both deployments
   and the production origin configuration are confirmed.

Closing Google's account picker returns no credential callback. Trove remains
on the auth page with the official button ready for another attempt.
