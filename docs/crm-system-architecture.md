# Bloomwood CRM System Architecture

## Recommendation

Use a split architecture:

- **Astro + React + shadcn/ui** for the internal CRM frontend
- **Supabase** for the CRM core backend
- **Cloudflare** for the website, deployment, and file-delivery edge workflow

This gives Bloomwood the best mix of:
- mobile-friendly custom UI
- manageable backend complexity
- lower ongoing tool cost than Fibery
- good fit with the Cloudflare work already in progress

## High-level architecture

### Frontend
The CRM UI lives inside the Bloomwood site repo and is rendered as an app-like internal section.

Suggested route space:
- `/crm`
- `/crm/clients`
- `/crm/clients/[id]`
- `/crm/jobs`
- `/crm/jobs/[id]`
- `/crm/tasks`
- `/crm/search`

### Backend split
#### Supabase owns:
- CRM relational data
- internal user accounts/auth
- row-level access control
- notes/tasks/jobs/client data
- search-friendly operational queries

#### Cloudflare owns:
- site hosting
- public Bloomwood website delivery
- secure download link workflow already scaffolded
- R2 delivery objects if you keep that path
- route protection at the edge where useful

## Why this split is the right one

### Why Supabase for the CRM core
The CRM is relational and operational:
- one client has many jobs
- one job has many notes/tasks
- workflows need filters and joins
- mobile dashboard views need useful queries

Postgres is simply a better fit for this than trying to make D1 carry the whole internal app.

### Why keep Cloudflare for delivery and hosting
You already have Bloomwood on Cloudflare and the file-delivery workflow was designed around:
- Workers
- D1
- R2
- expiring download links on your domain

That is a good edge-delivery use case and does not need to be uprooted just because the CRM moves to Supabase.

## Proposed responsibilities by subsystem

### 1) CRM core subsystem
Location:
- same Bloomwood repo

UI stack:
- Astro routes
- React islands/components
- shadcn/ui
- Tailwind

Supabase data model:
- clients
- jobs
- notes
- tasks
- file_deliveries
- app_users/profile metadata if needed later

### 2) Secure file delivery subsystem
Location:
- same repo, existing Bloomwood download work

Cloudflare data/storage:
- D1 for download metadata and token logs
- R2 for delivery files

Why keep separate:
- delivery links are edge-friendly
- large files belong in object storage, not in CRM tables
- tokenized downloads are not the same problem as CRM CRUD

### 3) Integration boundary between CRM and delivery
The CRM should not duplicate file-delivery state if it does not need to.

Recommended pattern:
- CRM `file_deliveries` table stores a reference to the Cloudflare download job/token batch
- Cloudflare delivery subsystem remains the source of truth for:
  - token state
  - download events
  - object keys/files
- CRM remains the source of truth for:
  - client
  - job
  - internal status/workflow notes

## Auth model

### CRM auth
Use **Supabase Auth** for the internal CRM.

Recommended starting auth mode:
- email + magic link or passwordless login
- invite-only internal users

Why:
- easy to get working
- mobile-friendly
- no need to build custom auth from scratch

### Download helper/admin route auth
The existing `/solutions/download-admin` helper is currently gated by a Cloudflare secret query key.
That is acceptable as a temporary internal helper, but it should not be the long-term CRM auth pattern.

## Recommended route design

### Public site routes
Keep these under the existing marketing structure:
- `/`
- `/solutions/*`
- `/media/*`

### Internal CRM routes
Use a dedicated namespace:
- `/crm/*`

This keeps the app mentally and technically separate from the public site.

## Suggested CRM app structure

### Layout
- `src/pages/crm/index.astro`
- `src/pages/crm/clients/index.astro`
- `src/pages/crm/clients/[id].astro`
- `src/pages/crm/jobs/index.astro`
- `src/pages/crm/jobs/[id].astro`
- `src/pages/crm/tasks.astro`
- `src/pages/crm/search.astro`

### Shared app code
- `src/components/crm/*`
- `src/lib/crm/*`
- `src/lib/supabase/*`

### Server/API routes
- `src/pages/api/crm/*`

## Data flow examples

### Client and job workflow
1. internal user signs in via Supabase Auth
2. user opens `/crm/jobs`
3. app queries Supabase for jobs + client summary
4. user opens a job detail page
5. app loads job, notes, tasks, delivery records from Supabase

### File delivery workflow
1. user opens a job in CRM
2. job shows associated file delivery record(s)
3. CRM can display:
   - pending upload
   - uploaded
   - link issued
   - delivered
4. if needed, user triggers the separate Cloudflare-backed delivery workflow
5. CRM stores/updates the reference and internal delivery status

## Recommended Supabase schema boundaries

Supabase should own:
- `clients`
- `jobs`
- `job_notes`
- `tasks`
- `file_deliveries`

Cloudflare D1 should own:
- `download_jobs`
- `download_files`
- `download_tokens`
- `download_events`

## Search strategy

### v1 search
Use Supabase/Postgres search for:
- client name
- business name
- phone
- email
- job reference
- job title

This is one of the strongest reasons to keep CRM data in Postgres.

## Mobile-first design decisions

Non-negotiables for the CRM:
- card-based list views on iPhone
- sticky search/header actions
- one-tap note/task creation from client and job screens
- visible status chips
- no desktop spreadsheet UI as the primary interaction model

## Operational phases

### Phase 1
- Supabase schema
- auth
- client list/detail
- job list/detail
- notes
- tasks

### Phase 2
- file delivery records inside CRM
- basic dashboard
- saved filters/search polish

### Phase 3
- deeper integration with the Cloudflare delivery subsystem
- admin flows that reduce CLI use
- better automation/reporting

## Risks to avoid

- rebuilding Fibery feature-for-feature
- mixing public-site concerns and CRM logic too early
- forcing Cloudflare D1 to be the main CRM database just because the site is hosted there
- making desktop-first tables the core UI model

## Final recommendation

Build the Bloomwood CRM as a **Supabase-backed internal app inside the existing Bloomwood repo**, and keep the secure file-delivery workflow as a **Cloudflare-native subsystem**.

That is the cleanest path to:
- lower cost than Fibery
- responsive iPhone-first usability
- flexible future workflows
- sane implementation complexity
