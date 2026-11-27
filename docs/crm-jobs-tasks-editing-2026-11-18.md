# Jobs and tasks editing sandbox — 18 November 2026

The private preview now supports creating and editing fictional jobs and their tasks at `/sandbox/jobs`. It uses only EDITING_DB, the dedicated fictional-data database. Supabase and DIRECTORY_STAGE are unchanged.

Jobs choose an existing test client; that relationship is immutable. Tasks inherit both job and client. Tasks support open, done and cancelled states, details, and whole billable/non-billable minutes. Completion timestamps are retained when editing a completed task and cleared when reopening it. Job totals include open and done tasks and exclude cancelled tasks. These are recorded time totals, not invoice amounts or service-pack allocation.

Jobs cannot close while open tasks remain. Closed jobs must reopen before their tasks can be edited. SQL predicates and database triggers enforce these rules. Version checks reject stale writes; form IDs prevent duplicate creation. Database triggers record the verified actor and version atomically. The existing Cloudflare Access identity checks and same-origin form protection apply to every new route.

Validation: 11 security tests, 14 existing CRM tests, and 17 UI tests passed. Desktop (1440px) and mobile (390px) browser flows created jobs and tasks, completed a task, and checked totals without horizontal overflow. Screenshots were inspected. A remote D1 rehearsal created explicitly fictional records and verified links, generated totals, completion, closure restrictions, stale-edit rejection and audit counts. This remote rehearsal uses a locally signed test identity against the actual sandbox database; it is not an end-to-end GitHub login test.

Migration 0002_jobs_tasks.sql was applied only to EDITING_DB. No real-data cutover, invoicing, service-pack editing, file migration, or production write migration is included.
