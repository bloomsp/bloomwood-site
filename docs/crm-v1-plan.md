# Bloomwood CRM v1 Plan

## Recommendation

Build a **mobile-first internal CRM v1** focused on Bloomwood’s real day-to-day work, not a full Fibery replacement on day one.

That means starting with:

- clients
- jobs
- notes
- tasks/follow-ups
- file delivery tracking
- simple dashboard/search

The goal is to replace the parts of Fibery that matter most in practice, while giving you a much better iPhone experience and removing subscription pressure over time.

## Product direction

### What this is
A lightweight internal operations app for Bloomwood.

### What this is not
- not a general-purpose no-code platform
- not a full accounting system
- not a full ticketing/helpdesk suite in v1
- not a public client portal in the first pass

## Why this makes sense

Your stated pressure points are:
- Fibery subscription cost
- desktop-oriented UI
- limited mobile flexibility
- desire for responsive iPhone-friendly access

A custom CRM makes sense **if we keep the scope narrow and operationally useful**.

## Core v1 workflows

### 1) Client management
You need a fast way to:
- search clients
- view contact details
- see active/past jobs
- add notes after calls/messages
- see outstanding follow-ups

### 2) Job management
You need to be able to:
- create a new job quickly
- attach it to a client
- track current status
- record device/problem details
- record outcome/delivery state
- move jobs through a simple workflow

### 3) Notes and contact log
You need lightweight chronological notes for:
- phone calls
- emails
- onsite visits
- decisions
- recovery observations

### 4) Task/follow-up tracking
You need to quickly capture:
- call back client
- waiting on part
- send quote
- send download link
- follow up after delivery

### 5) File delivery tracking
This overlaps directly with the paused download-link work.

You need to know:
- which job has downloadable files
- whether upload/link generation happened
- whether access is still active
- whether delivery is complete

## Mobile-first UI principles

This app should be designed for iPhone first.

### Rules
- one-handed use should feel normal
- primary actions always visible
- large tap targets
- no dense tables as the primary mobile view
- fast search from the top of the app
- status chips and cards instead of spreadsheet layouts
- quick-add note/task buttons on client/job screens

### Key mobile screens

#### Dashboard
Shows:
- today’s follow-ups
- active jobs
- overdue tasks
- recent activity

#### Clients list
Shows:
- search
- recent clients
- status filter
- tap into client card

#### Client detail
Shows:
- contact info
- current jobs
- recent notes
- outstanding tasks
- quick actions: add note, add job, call, email

#### Jobs list
Shows:
- active jobs by status
- filters for status/type/priority
- quick-create job

#### Job detail
Shows:
- job summary
- client
- device/problem details
- notes timeline
- tasks
- file delivery section
- quick status update buttons

#### Tasks view
Shows:
- due today
- overdue
- completed recently

## Recommended v1 modules

### Module 1: Clients
Suggested fields:
- `id`
- `display_name`
- `business_name`
- `email`
- `phone`
- `address`
- `preferred_contact_method`
- `tags`
- `status` (`active`, `inactive`, `lead`, `archived`)
- `created_at`
- `updated_at`

### Module 2: Jobs
Suggested fields:
- `id`
- `job_reference`
- `client_id`
- `title`
- `category` (`repair`, `recovery`, `support`, `web`, `writing`, etc.)
- `status` (`new`, `in_progress`, `waiting_client`, `waiting_parts`, `ready`, `completed`, `cancelled`)
- `priority` (`low`, `normal`, `high`, `urgent`)
- `device_type`
- `serial_number`
- `intake_details`
- `diagnosis`
- `resolution_summary`
- `opened_at`
- `closed_at`
- `created_at`
- `updated_at`

### Module 3: Notes
Suggested fields:
- `id`
- `client_id`
- `job_id`
- `note_type` (`call`, `email`, `onsite`, `internal`, `recovery`, `delivery`)
- `body`
- `created_by`
- `created_at`

Notes should allow either:
- client-only notes
- job-specific notes
- both

### Module 4: Tasks / follow-ups
Suggested fields:
- `id`
- `client_id`
- `job_id`
- `title`
- `details`
- `status` (`open`, `done`, `cancelled`)
- `due_at`
- `completed_at`
- `created_at`
- `updated_at`

### Module 5: File deliveries
This can either embed the existing download schema or reference it.

Suggested fields:
- `id`
- `job_id`
- `delivery_type` (`download_link`, `usb`, `external_drive`, `email`)
- `status` (`pending`, `uploaded`, `link_issued`, `delivered`, `expired`, `revoked`)
- `download_job_id` (if using the download-link subsystem)
- `notes`
- `created_at`
- `updated_at`

## Relationships

Recommended relationships:
- one client -> many jobs
- one client -> many notes
- one client -> many tasks
- one job -> many notes
- one job -> many tasks
- one job -> many file deliveries

## Suggested v1 status model

Keep statuses simple.

### Job statuses
- `new`
- `in_progress`
- `waiting_client`
- `waiting_parts`
- `ready`
- `completed`
- `cancelled`

### Task statuses
- `open`
- `done`
- `cancelled`

### Delivery statuses
- `pending`
- `uploaded`
- `link_issued`
- `delivered`
- `expired`
- `revoked`

## Search requirements

Search is critical on mobile.

v1 search should cover:
- client name
- email
- phone
- business name
- job reference
- job title

If search is slow or buried, the app will feel worse than Fibery immediately.

## Dashboard requirements

v1 dashboard should answer:
- what needs follow-up today?
- which jobs are active?
- what is waiting on me?
- what did I touch recently?

Suggested widgets:
- overdue tasks
- tasks due today
- jobs in progress
- waiting client
- waiting parts
- recent notes

## Suggested stack options

### Option A, recommended
**Astro + React islands + shadcn/ui + Supabase**

Why this is my recommendation:
- fastest path to a polished responsive UI
- good auth story if needed later
- Postgres is nicer for relational CRM data than D1
- easier filtering/search/querying as the app grows
- can still keep marketing pages in the same repo/site

### Option B
**Astro + React islands + Cloudflare D1 + R2**

Why choose this:
- more Cloudflare-native
- cheaper/simple infra
- aligns with your download-link subsystem

Why I would not pick it first for CRM:
- more backend plumbing friction
- relational app ergonomics are weaker than Postgres/Supabase
- auth/admin patterns take more effort

### Option C
**Separate internal app repo later**

Only do this if the internal CRM becomes large enough to justify separation.
For v1, keeping it in the Bloomwood repo is reasonable.

## Recommended v1 screen map

- `/crm`
- `/crm/clients`
- `/crm/clients/[id]`
- `/crm/jobs`
- `/crm/jobs/[id]`
- `/crm/tasks`
- `/crm/search`

## Suggested build phases

### Phase 1: operational MVP
Build:
- client list/detail
- job list/detail
- notes timeline
- task capture and completion
- mobile dashboard

### Phase 2: delivery integration
Add:
- file delivery tracking on job pages
- link issuance visibility
- download status visibility

### Phase 3: nicer workflow polish
Add:
- saved filters
- better search
- quick actions
- templates/snippets
- maybe calendar/reminder views

## Recommended implementation order

1. define data model
2. choose backend: Supabase vs D1
3. scaffold CRM routes/layout
4. build client + job core screens
5. add notes/tasks
6. integrate file delivery workflow

## My recommendation

Build a **narrow CRM v1** around Bloomwood’s actual operational workflow and optimize it for iPhone first.

If you want the best balance of speed, flexibility, and long-term sanity, I recommend:

- **Astro**
- **React islands**
- **shadcn/ui**
- **Supabase**

Then pull the existing Cloudflare-native download tooling into that app as a focused subsystem rather than forcing the whole CRM to be Cloudflare-only.
