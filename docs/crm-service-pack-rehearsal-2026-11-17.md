# Service catalog and pack rehearsal — 17 November 2026

Read one Supabase snapshot and imported all columns of 9 service types, 1 purchased pack and 1 job/pack usage record into bloomwood-crm-directory-rehearsal. No production writes or Worker changes. The staging schema is in crm-preview/rehearsal/service-packs.sql; no row data is committed.

Readback matched every field, preserving exact decimal values as text and representing booleans as SQLite integers. Verified the relevant client, job and task inputs still matched earlier staging copies, service type references resolved, and linked tasks and usage rows belonged to the pack's client. D1 foreign_key_check returned no issues. Running the CRM's own allocation logic against the source and staged records produced identical per-pack balances and status: 300 minutes purchased, 300 used, zero remaining. Stored usage agreed with task-derived usage. A final source fingerprint check confirmed the selected data did not change during the rehearsal.

Next: reconcile invoices and their line items, including header totals and links to prior staging tables. Supabase remains authoritative for all edits.
