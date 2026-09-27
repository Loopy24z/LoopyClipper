# Loofy Clip

A private video clipping studio: Google login, daily credits, transcript editing, suggested clips, captions, font/effect controls, and MP4 export.

Cloud architecture: **Next.js on Vercel + Supabase Postgres/Auth + private Cloudflare R2**. FFmpeg/faster-whisper runs in a separate Python processor on your computer or a trusted compute host. The web app does not perform long-running video work inside a Vercel function.

## Run locally

Requires Node 22.13+ and a configured Supabase/R2 account.

```sh
npm ci
cp .env.example .env.local
# Fill .env.local on your machine; never commit it.
npm run db:migrate
npm run dev
```

Open http://localhost:5174. Without Supabase configuration the login page explains setup; it does not auto-sign in as a demo user. This cloud copy uses port 5174 so the previous localhost:5173 project can remain intact.

See [deployment instructions](docs/DEPLOY.md) and [Google authentication](docs/AUTH.md).

## Processor

Requires Python 3.12, FFmpeg/FFprobe, Node (YouTube runtime), and enough CPU/disk for source and rendered video. First transcription downloads a Whisper model.

```sh
python -m pip install -r processor/requirements.txt
cp processor/.env.example processor/.env
# Set LOOFY_URL and PROCESSOR_TOKEN to match the web app.
python processor/worker.py
```

Docker alternative: `docker build -t loofy-processor processor` then `docker run --env-file processor/.env -v loofy-models:/models loofy-processor`.
A local processor stops when the computer sleeps or powers off. No free always-on compute service is included.

## Verification

```sh
npm test
npm run build
python -m unittest discover -s tests -p 'test_processor*.py'
```

Postgres tests run the real schema in PGlite. API integration tests use real PostgreSQL semantics with simulated auth/storage; worker tests inspect HTTP requests and ensure credentials never reach signed media hosts. These are not proof of a deployed Google/R2/YouTube end-to-end workflow. Live cloud acceptance still requires provider configuration and English/Indonesian source fixtures.

## Beta boundaries

- Daily credit reset uses Asia/Jakarta, defaults to 10 minutes/day, does not accumulate. Unlimited admin credit bypasses charging only; storage and video limits still apply.
- Admin identity uses verified Supabase user UUIDs in server-only ADMIN_USER_IDS. Typing an email never grants access.
- Suggested highlights and descriptions currently use transcript heuristics/excerpts, not a generative language model.
- Shared cloud storage defaults to **5 GiB across the entire app**, including active reservations and uncertain failed exports. Source <=2 GiB; export reservation <=1 GiB. Delete a project to release its reservations. This reduces usage but does not guarantee zero provider bills (operations, abandoned multipart uploads, other bucket content, and provider limits also matter).
- Subscription requests are disabled by default. When enabled on an eligible hosting plan, approval is manual; no payment processor or recurring charge exists.
- YouTube import may fail for restricted/unavailable videos; original file upload remains available. Confirm ownership/permission before import.
- Delete workspace data removes project media/transcripts. It does not delete the Supabase Auth identity or financial/admin records. Full account erasure and backup retention policy are still launch work.
- R2 signed URLs are temporary bearer links; keep them private. Project deletion removes stored media; any previously downloaded file cannot be revoked.

No credentials, old demo data, uploaded media, or model cache are included in this repository.
