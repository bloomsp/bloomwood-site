# Remaining CRM metadata rehearsal — 18 November 2026

Copied the ten previously omitted client columns, six job/client notes and one delivery metadata record into the isolated bloomwood-crm-directory-rehearsal database. Supabase was queried only with SELECT.

Before importing, the seven previously copied client fields and all job/client links matched the current source snapshot. The new fields preserve date-only values, timestamp strings, nulls and empty values. Tags use JSON text, with null distinct from an empty array. Full ordered readback matched all 17 fields for 15 clients, all seven fields for six notes and all eight fields for one delivery. Client/job relationships and any non-null note author references were checked; D1 foreign_key_check passed. The source fingerprint was unchanged after verification.

No auth users, sessions, passwords or binary files were migrated. No Worker routes or deployments were changed. The preview's directory still selects only display_name and status; contact details, DOB, tags and notes are not exposed by that page.

All ten public CRM tables now have their previously inventoried fields represented in staging. This completes the identified data-coverage gaps, not the production migration: the snapshots were taken at different times and require a fresh coordinated reconciliation before cutover. Writable D1 operations, authorization, constraints/triggers, backup/restore and rollback remain to be implemented and tested. Supabase remains authoritative for edits.
