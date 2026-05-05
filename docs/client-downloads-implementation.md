# Client Downloads MVP Implementation Notes

## Cloudflare bindings to add

Add these bindings when you wire the feature into deployment:

- D1 binding: `CLIENT_DOWNLOADS_DB`
- R2 binding: `CLIENT_DOWNLOADS_BUCKET`
- Worker secret: `DOWNLOAD_ADMIN_KEY`

## Cloudflare setup instructions

### 1) Create the R2 bucket
Create a bucket for client deliveries, for example:

- `bloomwood-client-downloads`

CLI:

```bash
npx wrangler r2 bucket create bloomwood-client-downloads
```

### 2) Create the D1 database
Create a database for download metadata and audit events.

CLI:

```bash
npx wrangler d1 create CLIENT_DOWNLOADS_DB
```

After creation, Cloudflare will print a database ID. Copy that value.

### 3) Add the bindings to `wrangler.jsonc`
Add these blocks to the existing Bloomwood config.

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "SESSION",
      "id": "164603dba67945b3b3bf853beba8fed9"
    }
  ],
  "d1_databases": [
    {
      "binding": "CLIENT_DOWNLOADS_DB",
      "database_name": "CLIENT_DOWNLOADS_DB",
      "database_id": "<paste-d1-database-id-here>"
    }
  ],
  "r2_buckets": [
    {
      "binding": "CLIENT_DOWNLOADS_BUCKET",
      "bucket_name": "bloomwood-client-downloads"
    }
  ]
}
```

If you prefer, the binding names can stay as above even if the actual Cloudflare resource names differ.

### 4) Set the admin helper secret
Set a Worker secret for the gated internal helper page.

CLI:

```bash
npx wrangler secret put DOWNLOAD_ADMIN_KEY
```

Choose a long random value. This secret is required for:
- `/solutions/download-admin?key=<your-secret>`

### 5) Apply the D1 migration
Run the download schema migration against the remote D1 database.

```bash
npx wrangler d1 execute CLIENT_DOWNLOADS_DB \
  --file ./migrations/0001_client_downloads.sql \
  --remote
```

### 6) Deploy Bloomwood
After bindings and secret are configured:

```bash
npm run deploy
```

### 7) Test the internal helper
After deploy, open:

```text
https://bloomwood.com.au/solutions/download-admin?key=<your-secret>
```

### 8) Strongly recommended: Cloudflare Access
The query key is only a light gate. Put this route behind Cloudflare Access as well.

Suggested Access policy:
- application hostname: `bloomwood.com.au`
- path: `/solutions/download-admin*`
- allow only your email identity
- optionally require OTP / identity provider login

## Files scaffolded in this repo

- `migrations/0001_client_downloads.sql`
- `src/lib/server/downloads.ts`
- `src/pages/solutions/download/[token].astro`
- `src/pages/api/download/[token]/file/[fileId].ts`
- `scripts/upload-download-files.mjs`
- `scripts/issue-download-link.mjs`

## What works now

This scaffold gives you:

- a tokenized landing page route
- a protected file download route
- D1 lookup helpers
- hashed-token lookup flow
- download event logging hooks
- download count incrementing

## What still needs wiring before production use

### 1) Add bindings in Cloudflare
Configure:
- D1 database bound as `CLIENT_DOWNLOADS_DB`
- R2 bucket bound as `CLIENT_DOWNLOADS_BUCKET`

### 2) Apply the D1 migration
Run the new SQL migration against the production database once created.

### 3) Internal issuance workflow
A first-pass script now exists to:
- create a job row
- create file rows
- generate a secure raw token
- hash and store the token hash
- print the final client link

Script entrypoint:
- `npm run downloads:issue -- --manifest <file> --db <database> --remote`

### 4) Upload recovered files to R2
The current scaffold assumes file objects already exist in the bucket and that `download_files.r2_key` points to them.

## Script usage

Example manifest:

```json
{
  "jobReference": "2026-0042",
  "clientName": "Jane Citizen",
  "clientEmail": "jane@example.com",
  "notes": "Recovered family photos",
  "expiresDays": 7,
  "files": [
    {
      "displayName": "Recovered Photos.zip",
      "r2Key": "recoveries/2026-0042/photos/recovered-photos.zip",
      "contentType": "application/zip",
      "sizeBytes": 1234567
    }
  ]
}
```

Issue a link against the remote D1 database:

```bash
npm run downloads:issue -- \
  --manifest ./client-download.json \
  --db CLIENT_DOWNLOADS_DB \
  --remote
```

Helpful flags:
- `--site-url https://bloomwood.com.au`
- `--dry-run`
- `--local`
- `--preview`

## Upload helper usage

Upload a local file or directory to R2 and emit a ready-to-issue manifest:

```bash
npm run downloads:upload -- \
  --source ./recovery-2026-0042 \
  --bucket bloomwood-client-downloads \
  --job-reference 2026-0042 \
  --client-name "Jane Citizen" \
  --client-email jane@example.com \
  --notes "Recovered family photos" \
  --remote
```

Helpful flags:
- `--manifest-out ./client-download.json`
- `--prefix recoveries/2026-0042`
- `--expires-days 7`
- `--dry-run`
- `--local`

## Internal admin helper

A simple internal helper page now exists at:
- `/solutions/download-admin`

Current access pattern:
- set Cloudflare secret `DOWNLOAD_ADMIN_KEY`
- open the page with `?key=<your-secret>`

This is intentionally lightweight. Before relying on it in production, I recommend adding Cloudflare Access or another stronger gate in front of the route.

## Recommended next implementation step

The best next improvement is to turn the helper into a true internal tool so you can:
- upload to R2
- create the manifest automatically
- issue the link in one flow
- revoke/regenerate links without touching the CLI
