# CRM staging gap review — 17 November 2026

Read-only comparison of Supabase public base tables and the isolated rehearsal D1 database. Compared column names and both directions of the primary-key sets. Checks were made against live services, not just checked-in migrations. This review did not recalculate all non-key field values; the prior phase reports record their point-in-time reconciliation.

| Table | Supabase | D1 | Column coverage |
|---|---:|---:|---|
| clients | 15 | 15 | 7 of 17 |
| jobs | 17 | 17 | complete |
| tasks | 23 | 23 | complete |
| service_types | 9 | 9 | complete |
| service_packs | 1 | 1 | complete |
| service_pack_usage | 1 | 1 | complete |
| invoices | 10 | 10 | complete |
| invoice_line_items | 11 | 11 | complete |
| job_notes | 6 | absent | all 7 missing: id, client_id, job_id, note_type, body, created_by, created_at |
| file_deliveries | 1 | absent | all 8 missing: id, job_id, delivery_type, status, download_job_id, notes, created_at, updated_at |

All eight copied tables had identical ID sets, with no staging-only rows. Of 94 source records, 87 IDs were present. The missing delivery is metadata linked to a job, with no external download job reference; this finding does not imply that any binary file should be copied.

Missing client fields (non-null counts unless noted): first_name 15, last_name 14, contact_name 3, contact_role 3, address 7, preferred_contact_method 15, tags 1 nonempty array, date_of_birth 2, created_at 15, updated_at 15. Preserve null vs empty arrays and date-only vs timestamp semantics. Restrict DOB, address and notes to workflows that actually need them; no values belong in the report or public preview. The job and client detail pages consume notes; job detail also consumes delivery metadata.

## Gates before moving live edits

1. Rehearse the two missing tables and client fields in staging. Check every copied field, client/job links, note authors and delivery references. No task or note currently has a non-null created_by. Define a durable staff ID for future writes instead of copying Supabase sessions.
2. Implement and test the production CRM operations against D1. The preview currently supports read-only listings, not the full CRM. Port authorization to all private page/API routes; enforce equivalent foreign keys, uniqueness, checks and transaction semantics. Seven source tables have updated_at triggers; invoice-line insert/update/delete also triggers a header-total refresh. Test moving a line between invoices and recalculating both totals, and prevent double invoicing a job or task.
3. Rehearse a fresh consistent snapshot with writes paused or a proven way of replaying changes. Compare fields, IDs, links and per-client/pack/invoice balances, and verify recovery from a backup. Establish a rollback plan that preserves any edits made after switching. Keep Supabase authoritative until these gates pass.

Scope excludes auth/storage internals and any external services or native clients. Nothing was copied or deployed in this assessment.
