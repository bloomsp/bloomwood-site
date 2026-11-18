# Private CRM preview

This standalone Worker serves a read-only directory at https://crm-preview.bloomwood.com.au/ and JSON at /api/clients. Both require a signed Cloudflare Access assertion and the configured staff email. The preview has its own D1 database with three fictional clients, no Supabase integration and no production CRM bindings. No browser scripts or third-party resources are loaded. workers.dev and version preview URLs are disabled.

## Enable staff sign-in

1. In Cloudflare Zero Trust, configure the chosen staff identity provider. If prompted for a team name, record the resulting team URL. Configure MFA at the provider or require MFA in Access.
2. Create a self-hosted Access application for the exact hostname crm-preview.bloomwood.com.au, with no path restriction. Allow only the approved staff email using an Emails selector, select the intended identity provider, and do not add an Everyone, Bypass or service-token policy.
3. In the preview Worker's Settings → Variables and Secrets, set ACCESS_ISSUER (the full https://TEAM.cloudflareaccess.com URL, without a trailing slash), ACCESS_AUD (the application's Audience/AUD tag), and STAFF_EMAIL (the exact approved address or comma-separated list of individually approved addresses). Set these as secrets so a Wrangler deployment does not replace dashboard variables. These can also be set via wrangler secret put NAME --config crm-preview/wrangler.jsonc. Do not put identity-provider client secrets into the Worker.
4. In a private window, confirm both paths challenge a signed-out user. Sign in with the approved account, confirm the directory contains exactly three sample clients and that /api/clients shows the same three. Repeat on iPhone Safari. Confirm an unapproved identity cannot view either path. Do not load real client records into this database.

## Maintenance

From the repository root: npm ci; npm run test:security. Apply migrations with npx wrangler d1 migrations apply PREVIEW_DB --config crm-preview/wrangler.jsonc --remote. Deploy only this Worker with npx wrangler deploy --config crm-preview/wrangler.jsonc. The root deployment command deploys the separate production website. Missing or invalid Access configuration denies requests before querying D1.

## Private staged directory

The separate /directory page reads names and status from DIRECTORY_STAGE, the 16 November 2026 rehearsal snapshot. It has the same Access checks as the sample routes. Only the sample database is served by /api/clients. To remove the staged view, remove its route and binding and redeploy this preview Worker.

## Client editing sandbox

The first writable flow is at /sandbox/clients. It supports creating and editing all existing client form fields, but only in the separate EDITING_DB binding (bloomwood-crm-editing-sandbox). Use fictional records only. DIRECTORY_STAGE remains read-only; no job/task/invoice editing or production cutover is implemented.

Apply only this database's schema with:
`npx wrangler d1 migrations apply EDITING_DB --remote --config crm-preview/wrangler.jsonc`

Approved Access identities are checked before any database operation. POST requires an exact Origin match and rejects cross-site fetch metadata. Each form has a UUID and record version. Insert retries do not create duplicates; stale edits return 409. Audit inserts are database triggers, so client and audit writes succeed or fail together. Actor IDs use the verified Access issuer and subject. No raw records or JWTs are logged.

The Worker tests use signed test identities and SQLite fixtures. The browser tests use a local HTTP fixture to exercise forms at desktop and mobile widths. To explicitly test writes against the remote fictional database, run `node crm-preview/verify-editing-d1.mjs --remote-sandbox`. Each run creates a fictional test client. That script's fixed target is not the migrated database.

The original Referrer-Policy no-referrer can suppress Origin on form navigation. It is now same-origin: same-origin forms retain their origin while external destinations receive no referrer. The form CSP allows only same-origin submissions.
