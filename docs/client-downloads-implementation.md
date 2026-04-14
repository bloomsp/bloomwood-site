# Client Downloads MVP Implementation Notes

## Cloudflare bindings to add

Add these bindings when you wire the feature into deployment:

- D1 binding: `CLIENT_DOWNLOADS_DB`
- R2 binding: `CLIENT_DOWNLOADS_BUCKET`

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

## Recommended next implementation step

The fastest next improvement is a tiny internal admin page so you can:
- upload to R2
- create the manifest automatically
- issue the link in one flow
- revoke/regenerate links without touching the CLI
