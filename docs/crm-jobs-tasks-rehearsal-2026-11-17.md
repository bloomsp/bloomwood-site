# Jobs and tasks rehearsal — 17 November 2026

Source: one SELECT snapshot from Bloomwood CRM (Supabase). Target: the existing isolated bloomwood-crm-directory-rehearsal D1 database. No production writes or changes to Worker routes. No raw client or operational records are included in the repository.

- Matched all 15 client IDs before import. Every non-null client and job reference resolved; tasks specifying both a client and a job agreed with their job's client.
- Copied 17 jobs (all 24 source columns) and 23 tasks (all 16 columns). One task had no job and remained standalone.
- Compared D1 rows ordered by ID with the source snapshot, field by field, including nulls. Numeric rates and amounts use exact decimal text; timestamps retain their source representation.
- Compared task counts and summed billable minutes for every job group and the standalone group. Task billable minutes total 2,055. The separate job-level billable minutes total 1,890; these metrics are not additive.
- D1 foreign-key validation passed. Re-reading the source snapshot fingerprint after the import confirmed it had not changed.
- Service type, service pack and staff references remain identifiers only. Those related tables, invoices, invoice line items and separate job notes were not migrated. All edits still belong in Supabase.

The schema is in crm-preview/rehearsal/jobs-tasks.sql. It is intentionally separate from the sample database migration directory and is not a recurring sync.
