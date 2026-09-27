# Deploy Supabase + Vercel + Cloudflare R2

This is a new cloud installation. Original SQLite/demo users and uploaded videos are not automatically copied. Configure accounts below in their dashboards; never send secrets in chat or commit `.env` files.

## 1. Supabase

Create a Free project. In Connect, copy the **transaction pooler** connection string into server-only `DATABASE_URL` in `.env.local`; replace its password locally (URL-encode special characters). Use the displayed port. This app disables prepared statements and limits server connections to 3 per process. SSL is required by default.

Set public Supabase URL/publishable key, then run:

```sh
npm ci
npm run db:migrate
```

Migrations are transactional, checksum tracked and serialized; run against a new project, not an unrelated database. Application tables have RLS enabled and no browser policies/grants. Only the authenticated Next server queries them. The database connection must therefore have server privileges. Never expose DATABASE_URL in the browser.

Complete [Google OAuth setup](AUTH.md). To grant admin, sign in with your intended Google account first, verify the email in Supabase Authentication > Users, copy that user's UUID to server-only `ADMIN_USER_IDS`, and redeploy. The intended owner's email is not an authorization rule.

## 2. Cloudflare R2

Create a **private Standard storage** bucket, disable public access, and create a bucket-scoped Object Read & Write credential. Set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in `.env.local` and Vercel environment settings.

Set this CORS policy under bucket Settings, replacing the production origin:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5174", "https://YOUR-APP.vercel.app"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

Add a bucket lifecycle rule to abort incomplete multipart uploads after **1 day**. Completed objects have no automatic expiration; creator deletion removes them. A lost upload older than this rule needs a new project/upload. The app checks server-reported part sizes/ETags before completion. Source and output bytes go directly to R2; Vercel handles small metadata requests only.

Signed parts expire after 15 minutes; private playback/download links expire after one hour. Keep these bearer links private. R2 free allowance is account-wide and excess usage can be billed. The database defaults to a shared 5 GiB reservation ceiling; this is not a billing hard cap. Monitor actual bucket storage and operations, including aborted/unfinished multipart uploads and any unrelated account usage.

## 3. Vercel

Import **Loopy24z/LoopyClipper** from GitHub. Select Next.js, root directory `.`, Node 22, build `npm run build`. Add the variables from `.env.example` in Environment Variables; set NEXT_PUBLIC_APP_URL to the actual HTTPS production origin before enabling OAuth. Apply the database migration locally first; builds do not run migrations.

Generate PROCESSOR_TOKEN locally with a password manager or `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`; store the same value in Vercel and processor/.env. Never commit the generated value. No Supabase service-role key or R2 key belongs in processor/.env.

For protected previews, the worker can use a Vercel automation bypass secret in `VERCEL_AUTOMATION_BYPASS_SECRET`. It is sent only to the app API, never to media URLs. Use a stable configured app origin; HTTP is accepted only for localhost worker development.

**Vercel Hobby is limited to personal non-commercial use.** A commercial subscription service needs an eligible paid hosting plan. `ENABLE_SUBSCRIPTIONS=false` is the beta default; this feature flag alone does not make a commercial application eligible for Hobby. Enabling subscriptions exposes manual requests/approval, not automated payment.

## 4. Run the processor

Follow README. Set LOOFY_URL to the deployed app origin, then start `python processor/worker.py`. Keep the computer awake while processing. Whisper/FFmpeg work executes locally, so there is no Vercel video render time limit, but CPU, network, electricity and local disk usage remain yours.

## 5. Launch checks still required on your real accounts

- Google account chooser, correct user email/UUID, admin grants, sign-out and separate second-user isolation.
- MP4/MOV direct upload with CORS ETag, source preview, transcript and suggestions in English and Indonesian.
- Export 9:16 / 1:1 / 16:9 with captions and chosen font/effect; download playable H.264/AAC.
- Interrupted processing retry, failed export reservation, project deletion retry, and R2 multipart cleanup.
- YouTube permitted public source; restricted source error falls back to file upload.
- Provider usage/billing checks. Five GiB shared reservation is a conservative application policy, not a promise of free operation.

Current automated tests use PGlite PostgreSQL and storage/auth stubs. They do not certify live OAuth, R2 CORS, external YouTube availability, speech timing accuracy or expected production concurrency. Supabase Auth identity deletion and backup expiry guarantees remain launch work.

Official references: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Vercel function limits](https://vercel.com/docs/functions/limitations), [Supabase pricing](https://supabase.com/pricing), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 signed URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
