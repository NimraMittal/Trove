# Google authentication backend

The backend accepts a Google Identity Services ID token at
`POST /api/auth/google` using a strict JSON body:

```json
{
  "credential": "GOOGLE_ID_TOKEN"
}
```

The request must come from the configured `APP_ORIGIN`. The endpoint is rate
limited, accepts at most 16 KiB of JSON, and limits the credential field to
8 KiB. Raw Google credentials are passed to Google's verifier and are never
stored or logged.

## Identity and account policy

The official `google-auth-library` verifies the token signature, issuer,
expiration, and the configured web-client audience. Trove stores the verified
Google `sub` as the durable provider identity. Email is used only when deciding
whether to create a new Trove user.

Automatic account creation currently accepts either a verified `@gmail.com`
identity or a verified Google Workspace identity with a valid `hd` claim.
Other verified Google accounts need an additional email-verification flow
before Trove can safely create an account.

Trove does not link accounts merely because their emails match. If a verified
Google identity uses an email already assigned to a Trove user, the endpoint
returns a controlled conflict response without creating an identity or a
session. Explicit account linking will be implemented in a separate feature
that requires authentication through the existing account method.

After Google authentication succeeds, Trove creates its normal database-backed
session and sends the existing HttpOnly session cookie. Google ID tokens are
never used as Trove session tokens.

## Configuration

Set `GOOGLE_WEB_CLIENT_ID` on the backend to the OAuth 2.0 **Web application**
client ID whose audience Google puts in the ID token. It is an identifier, not
a client secret. Do not configure a Google client secret for this token flow.

The Google Cloud client will also need the production frontend origin once the
separate frontend integration is implemented. The backend change does not add
a Google button or perform a real Google sign-in.

## Tests

Run the existing and Google-specific authentication suites from `backend/`:

```bash
npm run test:auth
npm run test:auth-google
```

The Google test suite aborts unless `DATABASE_URL` points to loopback
`trove_development`. It uses mocked verified-token results, creates uniquely
identified database fixtures, and removes them by user ID. It does not contact
Google or prove that a real Google Cloud client is configured correctly.
