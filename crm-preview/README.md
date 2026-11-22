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

### Fictional jobs and tasks

Visit `/sandbox/jobs` to create a job for a test client, add tasks, record billable/non-billable minutes, and complete tasks. Close a job after finishing or cancelling its open tasks; reopen it before editing tasks again. Totals exclude cancelled tasks. This does not calculate invoices or service-pack coverage. Apply `editing-migrations/0002_jobs_tasks.sql` through the EDITING_DB migration binding before deploying. See `docs/crm-jobs-tasks-editing-2026-11-18.md` for validation and scope.

### Fictional service types and packs

Visit `/sandbox/services` to maintain service names and hourly reference rates (AUD, stored in whole cents). Visit `/sandbox/packs` to create a pack for a test client and service, with a purchased allowance in whole minutes (60 minutes = one hour). A pack's client/service links cannot change after creation.

On an existing task, use **Service and pack allocation** to choose its service and optional matching client pack. Exhausted packs remain selectable; excess time is shown as overflow. Pack details derive balances from non-cancelled tasks in creation order (ID breaks ties). Open tasks reserve time, non-billable time consumes no allowance, and cancellations/reassignments restore available time. Reducing a purchased allowance can increase overflow; balances never become negative. These are sandbox reference rates and time allocations, not invoicing or historical price snapshots.

Apply migration `0003_services.sql` to EDITING_DB before deploying. Rate/pack edits and task assignments use version checks and atomic audit triggers; database triggers reject mismatched pack/client/service links. `npm run test:security`, `npm run test:crm`, and `npm run test:ui` cover this stage; the opt-in remote verification script includes the service-pack scenario using fictional records only.

### Fictional invoices

`/sandbox/invoices` creates drafts from selected completed tasks for one client. The selection lists each task's job, uncovered minutes and current amount; fully pack-covered, unpriced, cancelled, open or already-reserved tasks are excluded. Drafts save client name, task description, billable/covered minutes, hourly rate in cents and rounded per-task amounts. Rates are captured atomically when the draft is created. There is no invoice sending, tax calculation, PDF, credit note or payment integration in this sandbox.

Drafts reserve tasks using a unique active claim. Creating the invoice, lines and audit is one database statement with triggers, so a failed or competing claim leaves no partial invoice. Draft → issued → paid and draft/issued → cancelled are supported with version checks and audit entries. Cancelling retains the saved invoice but releases its claims. Paid invoices are final here. Changing a service rate does not alter saved lines.

Active invoice claims lock their tasks and associated shared pack allocations/allowances to keep saved coverage consistent. Cancel a draft or issued invoice to change that work; paid-invoice corrections are a future credit-note workflow. Job billing summaries exclude reserved tasks while still counting their pack consumption. No real CRM data is changed.

Apply `0004_invoices.sql` only to EDITING_DB before deployment. The remote opt-in verification includes invoice duplicate races, saved price checks, cancellation/rebilling and issued/paid transitions. Browser tests cover draft → issued → paid on desktop and mobile. Local tests also check atomic rollback on invalid selections and audit failure.

### Private test files

`/sandbox/deliveries` implements staff-only upload/download/revoke for fictional files up to 5 MB, linked to a test job. Downloads expire seven days after upload. R2 objects use generated keys and are served only as attachments through the authenticated Worker. Download availability is checked again after fetching the object, and successful claims are audited. Revocation stops new requests; it does not recall previously downloaded bytes. Upload failure leaves a non-downloadable record; an object written before a D1 failure can remain private in R2 for later cleanup.

The dedicated private bucket `bloomwood-crm-editing-files` is bound as `EDITING_FILES` in this preview's Wrangler config. Migration `0005_deliveries.sql` is applied to EDITING_DB. Public r2.dev access was verified disabled. Never enable a public bucket URL. After R2 activation, the real D1/R2 rehearsal passed upload, exact-byte download, audit and revocation checks. Re-run explicitly with `node crm-preview/verify-deliveries-remote.mjs --remote-sandbox`; this uses a signed local test identity with real storage adapters, not a browser login against the deployed Worker. A fictional revoked file is retained privately after each run.

Delivery messages are previews only. No email is sent and no client-facing link is generated: the preview hostname requires staff Access. Production contact forms currently use MailerSend. Migrating outgoing email requires verifying Cloudflare Email Sending domain configuration and the chosen sender before switching providers. Do not replace incoming-mail MX records to enable outbound sending. See https://developers.cloudflare.com/email-service/configuration/domains/ . Public client delivery and live email verification remain separate rollout steps; existing production workflows are unchanged.

### Client download links (fictional preview)

The separate `bloomwood-files-preview` Worker (`wrangler.files.jsonc`) exposes only `/d/<random-token>` and its `/download` route at `files-preview.bloomwood.com.au`. No CRM routes are present. Its R2 bucket remains private. The staff Worker generates 256-bit random tokens on an authenticated, same-origin POST and stores only SHA-256 hashes. Replacement invalidates the old link; delivery expiry and revocation apply to all links. Public downloads are limited to ten per generated link. The conditional counter update rechecks availability after R2 fetch and records the claim through the existing atomic audit trigger. Landing-page visits do not consume downloads. Full files are attachment responses; no scripts, third-party content, referrer or caching are enabled. Public Worker observability is disabled to avoid recording bearer URLs in application logs. Treat links as credentials.

Email sending is opt-in from the staff UI and requires DELIVERY_EMAIL, DELIVERY_FROM and DELIVERY_TEST_TO. The recipient is server-configured, never taken from browser input or fictional client data. Configure the Cloudflare send binding with `destination_address` matching DELIVERY_TEST_TO for additional enforcement. The chosen sender must be onboarded. The action generates a replacement link and sends plain text through Cloudflare's structured email API. Version checks reject replays. A send error may be ambiguous: check the recipient inbox before retrying; another generation invalidates the earlier link. Provider acceptance is not inbox confirmation. No live email binding is deployed until the sender and test recipient are confirmed.

### Xero draft integration — Demo Company only

`/sandbox/xero` connects a confidential Web OAuth app. Register redirect URI `https://crm-preview.bloomwood.com.au/sandbox/xero/callback` in the Xero app. The client ID is configured; add the app secret as Cloudflare Worker secret `XERO_CLIENT_SECRET` on **bloomwood-crm-preview**. Never store the client secret in source or chat. XERO_TOKEN_KEY is a generated 32-byte base64 AES-GCM key stored as a Worker secret. Do not rotate it without reconnecting. XERO_DB is a separate private D1 database, not bound to the public download Worker. Apply its `xero-migrations` and EDITING_DB's `0007_xero.sql` before deploying.

OAuth state is hashed, bound to the verified staff actor, expires after ten minutes and is consumed once. Access/refresh tokens are encrypted before storage. Refresh uses a database lease and saves rotated credentials. Requested scopes: offline_access, accounting.invoices, accounting.contacts.read, accounting.settings.read. The organisation endpoint must return IsDemoCompany=true and BaseCurrency=AUD; other organisations cannot export. Reconnection or authorisation failure does not enable live organisations.

Open a CRM draft and choose **Create draft in Xero Demo Company**. Explicitly choose a matching existing Xero contact, active revenue account, tax type, inclusive/exclusive amounts and invoice/due dates. The selector currently shows the first page of active contacts. No contacts are created automatically. Each saved CRM line is exported as quantity 1 with its exact saved currency amount and the uncovered minutes in its description. Xero calculates tax. The request always creates an ACCREC DRAFT; no invoice email or authorisation action is called.

A durable export claim freezes local invoice transitions before the remote call. The request body and tenant are saved, a stable idempotency key is supplied, and Xero's ID, invoice number, status and total are persisted separately. Xero only retains idempotency keys for six minutes, so ambiguous responses never automatically resubmit. **Refresh from Xero** performs a read-only reference lookup (or ID lookup) and validates invoice type, currency, contact and reference. If no unique match exists, the reservation remains until reviewed. CRM status buttons are disabled for all exports, including uncertain ones. Xero is authoritative for subsequent status/sending; refresh records status without releasing task reservations. Voids, credits and automatic reservation reconciliation need a separate verified workflow.

Validation uses simulated Xero HTTP responses, OAuth/state/encryption/refresh tests and desktop/mobile forms. No real Xero invoice has been created before app-secret setup and staff authorisation. Test against the Australian Demo Company before proposing production access.

References: https://developer.xero.com/documentation/api/accounting/invoices/ ; https://developer.xero.com/documentation/guides/oauth2/scopes/ ; https://developer.xero.com/documentation/guides/idempotent-requests/idempotency/ .

### Xero-first invoicing, products and discounts

Invoice selection now starts with **Create invoice in Xero**, saves a local reservation and goes directly to Xero details. Local issue/payment controls are removed (server requests for those statuses are rejected). Unexported drafts can be discarded; exported invoice number/status come from Xero. Older test invoice records remain intact.

`/sandbox/items` lets staff select an authorised Xero organisation and import its sales catalogue using GET requests only. Connect/update Xero access and authorise live Bloomwood alongside Australian Demo Company to load live products. The export path still verifies Demo Company immediately before creating any invoice. Import is transactional per catalogue; unavailable items are deactivated and existing task/invoice prices remain snapshots. Items missing a price are listed but cannot be added. SPack anywhere in the code, case-insensitively, identifies a new service-pack product sale.

On a task, **Products and discounts** supports multiple product lines, positive quantities (up to four decimal places) and per-line percentage discounts (0–100%, two decimal places). Four-decimal Xero prices are preserved. Integer arithmetic rounds net line amounts to cents. Adding products replaces hourly billing for that task; recorded time remains visible but is not charged again. Existing service-pack consumption and selling a product use separate tasks. A new SPack sale does not infer/create the hours allowance: that still requires an explicitly configured client service pack.

Invoice creation snapshots all product lines atomically and claims their parent task against double billing. Discounts, quantities and item codes are passed to Xero using unitdp=4. Live-only codes are included in descriptions when exporting to Demo; ItemCode is included only if that code exists in the target catalogue or the source and target tenant match. Demo defaults/account/tax treatment are explicitly selected at export. No items are written to either Xero catalogue. Source prices and discounts shown in the CRM are before the export's explicit inclusive/exclusive tax treatment.

Local validation covers read-only live import via simulated responses, SPack detection, discounts, saved invoice lines, stale edits, reserved-task locks and mobile/desktop product forms. Real product loading requires the staff member to authorise/select live Bloomwood in Products. No live invoice creation is enabled.

### Standalone product invoices

The invoice form accepts a client and up to five catalogue product lines with quantities and percentage discounts. Completed tasks are optional and can be included on the same invoice. Migration `0009_direct_products.sql` snapshots direct products separately from task reservations; creation, line snapshots and audit are atomic. Totals and Xero exports include both types without double-counting task products. Saved prices remain fixed if the catalogue changes. Discard and recreate an unexported draft to correct its lines.

Service-pack products remain sales only; automatic creation of an hours allowance on payment is not implemented. Xero writes remain restricted to the Australian Demo Company.
