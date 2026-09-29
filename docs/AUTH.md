# Google sign-in with Supabase

The cloud app uses verified Supabase Auth sessions. There is no automatic demo sign-in, trusted identity header, or local admin bypass.

## Setup

1. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project's Connect dialog. These are public client configuration; never place a service-role key in a `NEXT_PUBLIC_` variable.
2. Set `NEXT_PUBLIC_APP_URL` to the exact application origin, for example `http://localhost:5174` during development and `https://your-project.vercel.app` in production. Production requires HTTPS. Use separate environment values for local, preview, and production deployments.
3. Create a Google OAuth Web application. Add the app's origin to Authorized JavaScript origins. Add the Supabase callback shown in **Authentication > Sign In / Providers > Google**, normally `https://<project-ref>.supabase.co/auth/v1/callback`, to Google's Authorized redirect URIs.
4. Enable Google in Supabase and enter the Google client ID and client secret there. Do not commit these credentials or put the Google secret in browser environment variables. If Google's consent screen is in testing, add approved testers under Audience.
5. In Supabase **Authentication > URL Configuration**, set the deployed Site URL. Allow the app callbacks `http://localhost:5174/auth/callback**` and `https://your-project.vercel.app/auth/callback**`. The final wildcard permits the local `next` query string. Use exact trusted origins; do not allow every Vercel project.
6. Open `/login`, choose **Continue with Google**, select the intended account, and return to the workspace in the same browser. Only after a real verified sign-in should the intended identity receive admin privileges through the server's admin configuration.

The selected Google account's email must be confirmed by Supabase. Display names are display-only metadata and never grant privileges. An email written into an environment allowlist does not create or sign in that Google account.

## Routes and integration

- `GET /login`: account chooser entry page; checks the public Supabase provider settings before offering Google sign-in. Missing configuration or a disabled Google provider shows setup-needed; network failures show a retry message. Existing verified sessions can still continue to the workspace.
- `POST /auth/google`: starts Google OAuth with `prompt=select_account` and PKCE. A `next` form field can name an internal application path.
- `GET /auth/callback`: exchanges the one-use code using the browser's PKCE verifier cookie and redirects to a safe internal path.
- `POST /auth/signout`: ends this browser's session. Use a normal same-origin POST form; sign-out is not a GET link.
- `getCurrentUser()` from `lib/auth.ts`: returns `{ userId, email, fullName, displayName }` only after `auth.getUser()` verifies the session and confirmed email.
- `isAuthConfigured()` from `lib/auth.ts`: reports public auth configuration availability without calling the database.

The Google POST route also checks provider availability, so a stale page cannot send the creator into a known-disabled provider. This availability check is not authentication and does not validate Google client credentials or the callback allowlist.

## Current production setup

For the LoopyClipper deployment, use these exact values:

| Setting | Value |
| --- | --- |
| Google authorized JavaScript origin | `https://loopyclipper.vercel.app` |
| Google authorized redirect URI | `https://vrimtaefxeqavlfkhuyw.supabase.co/auth/v1/callback` |
| Supabase Site URL | `https://loopyclipper.vercel.app` |
| Supabase allowed app callback | `https://loopyclipper.vercel.app/auth/callback**` |
| Optional local app callback | `http://localhost:5174/auth/callback**` |

Create a Web application OAuth client in Google Cloud. Enter the client ID and secret directly in this project's Supabase Google provider settings. If Google is in testing mode, add the intended Google account as a test user. These are setup values, not evidence that live login has passed.

`proxy.ts` refreshes and validates auth cookies. Every protected API must independently call `getCurrentUser()`; the proxy is not authorization. OAuth redirects use `NEXT_PUBLIC_APP_URL`, never forwarded host headers. Login and sign-out POST routes check the request Origin. Redirect targets cannot be external or an auth endpoint. Session-bearing responses are marked private/no-store.

## Verification

Run `node --test tests/auth.test.mjs` for redirect and cross-site POST regression checks. The real OAuth flow still requires a configured Supabase project and Google client. Verify account selection, cancelled login, callback success, sign-out, session refresh, and access denial from another account before launch.

Official references: [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs), [Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google), [verified getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
