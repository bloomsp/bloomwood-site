# Client Download Architecture for Recovered Data

## Recommendation

Use a simple download-only flow built from:

- **Cloudflare R2** for recovered files
- **Cloudflare D1** for file metadata, expiring tokens, and download logs
- **Cloudflare Worker routes** on `bloomwood.com.au` for issuing and validating links

This is the best fit for Bloomwood because it stays Cloudflare-native, avoids a full login portal, and keeps client downloads on your own domain.

## Goals

- Let clients download recovered files from a Bloomwood URL
- Avoid building accounts/passwords
- Support expiring access
- Allow manual revoke/regenerate
- Keep an audit trail of access
- Avoid exposing raw bucket URLs

## Recommended user flow

1. Admin uploads recovered client files to **R2**
2. Admin creates a download batch record in **D1**
3. System generates a secure token with expiry
4. Client receives a link such as:
   - `https://bloomwood.com.au/solutions/download/<token>`
5. Worker validates:
   - token exists
   - token is active
   - token is not expired
   - optional max download count not exceeded
6. Worker streams the file from **R2** to the client
7. Worker records the download event in **D1`

## URL strategy

Recommended public URL patterns:

- Download landing page:
  - `/solutions/download/[token]`
- Optional bundle/file selector page:
  - `/solutions/download/[token]/files`
- Optional direct file route:
  - `/solutions/download/[token]/file/[fileId]`

Keep tokens opaque and random. Do not include client names or job details in the URL.

## Storage layout

### R2 bucket
Use one bucket for recovered-data delivery, for example:

- `bloomwood-client-downloads`

Recommended object key pattern:

- `recoveries/<jobId>/<fileId>/<originalFilename>`

Example:

- `recoveries/2026-0042/8f1b2c/report.zip`
- `recoveries/2026-0042/8f1b2d/photos.tar`

Why this shape works:
- stable grouping by job
- avoids filename collisions
- lets you replace display names without changing storage design

## D1 schema

### 1) download_jobs
One record per client delivery batch.

Suggested fields:

- `id` TEXT PRIMARY KEY
- `job_reference` TEXT NOT NULL
- `client_name` TEXT NOT NULL
- `client_email` TEXT
- `notes` TEXT
- `status` TEXT NOT NULL DEFAULT 'active'
- `expires_at` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL
- `revoked_at` TEXT

### 2) download_files
One record per downloadable file.

Suggested fields:

- `id` TEXT PRIMARY KEY
- `job_id` TEXT NOT NULL
- `r2_key` TEXT NOT NULL
- `display_name` TEXT NOT NULL
- `content_type` TEXT
- `size_bytes` INTEGER
- `sha256` TEXT
- `created_at` TEXT NOT NULL

Indexes:
- index on `job_id`

### 3) download_tokens
One or more tokens per job, depending on whether you want regeneration/history.

Suggested fields:

- `id` TEXT PRIMARY KEY
- `job_id` TEXT NOT NULL
- `token_hash` TEXT NOT NULL UNIQUE
- `status` TEXT NOT NULL DEFAULT 'active'
- `expires_at` TEXT NOT NULL
- `max_downloads` INTEGER
- `download_count` INTEGER NOT NULL DEFAULT 0
- `last_downloaded_at` TEXT
- `created_at` TEXT NOT NULL
- `revoked_at` TEXT

Important:
- store **token hash**, not the raw token
- email/share the raw token only once when generated

### 4) download_events
Audit log for access.

Suggested fields:

- `id` TEXT PRIMARY KEY
- `token_id` TEXT
- `job_id` TEXT
- `file_id` TEXT
- `event_type` TEXT NOT NULL
- `ip_hash` TEXT
- `user_agent` TEXT
- `country` TEXT
- `created_at` TEXT NOT NULL
- `detail` TEXT

Event types:
- `view`
- `download`
- `expired`
- `revoked`
- `not_found`
- `blocked`

## Token design

Use long random tokens, for example 32 bytes or more from a cryptographically secure generator.

Recommended defaults:

- expiry: **7 days**
- token type: **single active token per job**
- default downloads: unlimited within expiry
- optional setting for **single-use** on especially sensitive recoveries

### Why hashed tokens
If D1 is ever exposed, raw download tokens are not immediately usable.

Pattern:
- generate raw token
- hash with SHA-256
- store hash in D1
- compare incoming token by hashing request token

## Worker behavior

### Route 1: token landing page
`GET /solutions/download/:token`

Behavior:
- hash token
- look up active token in D1
- reject if missing/revoked/expired
- load associated files
- show a simple branded page with:
  - client/job reference
  - expiry date
  - file list
  - download buttons

### Route 2: file download
`GET /solutions/download/:token/file/:fileId`

Behavior:
- validate token again
- ensure `fileId` belongs to token's job
- fetch object from R2
- stream response with:
  - `Content-Type`
  - `Content-Disposition: attachment`
  - `Cache-Control: private, no-store`
- record download event in D1
- increment token download count if you enforce usage limits

### Route 3: revoke/regenerate (admin only)
This can be a private admin action, CLI flow, or internal endpoint.

Behavior:
- revoke current token
- issue new token
- keep prior audit trail intact

## Security defaults

Use these by default:

- raw R2 bucket must never be public
- all downloads go through Worker validation
- token hashes only in D1
- `Cache-Control: private, no-store`
- revoke links manually if needed
- rate-limit token routes
- do not leak whether a client name/job exists on invalid token requests
- use generic error messages on invalid or expired links

### Optional extra protections

Good optional additions:
- **Turnstile** challenge after repeated failed token requests
- block obvious bot abuse with WAF/rate limiting
- optional ZIP-at-rest encryption before upload for highly sensitive jobs
- auto-delete expired objects after retention window

## Retention policy suggestion

Simple operational default:

- links expire after **7 days**
- files retained for **30 days after delivery**, unless extended
- revoked/expired token rows kept for audit history
- download event logs kept for at least **12 months**

## Upload/admin workflow

For the first version, keep admin tooling simple.

### Phase 1 admin workflow
- upload files manually to R2
- insert job/file/token records with a small internal script or admin page
- copy generated link into email/message to client

### Phase 2 admin workflow
- simple internal form to:
  - create job
  - upload file(s)
  - set expiry
  - generate link
  - revoke/regenerate link
  - view access log

## Recommended implementation phases

### Phase 1, smallest useful build
Build only:
- D1 schema
- Worker token validation
- R2 streaming download route
- simple landing page for file list
- token generation script

This gets you a secure MVP quickly.

### Phase 2, nicer operations
Add:
- admin page/form
- revoke/regenerate controls
- download event viewer
- retention cleanup job

### Phase 3, polish
Add:
- branded email templates
- single-use mode toggle
- bulk ZIP generation if useful
- automated expiry reminders

## Suggested technical structure in Bloomwood

A practical fit for this repo:

- Astro pages for the visible download landing UI
- API/Worker routes for token validation and streaming
- D1 binding for metadata
- R2 binding for file objects

Likely project pieces:
- `src/pages/solutions/download/[token].astro`
- `src/pages/api/download/[token]/file/[fileId].ts`
- `src/lib/server/downloads.ts`
- `migrations/` for D1 tables

## Recommendation

Start with a **download-only MVP**:

- R2 bucket
- D1 tables
- one tokenized landing page
- one protected file download route
- one internal token generation script

That is the right balance for Bloomwood now, without dragging you into account management.
