# Client directory migration rehearsal — 16 November 2026

Source: Bloomwood CRM, Supabase public.clients, SELECT only. Destination: isolated Cloudflare D1 database bloomwood-crm-directory-rehearsal (Oceania); no Worker binding or public endpoint was added. The existing CRM and the fictional-data preview were not modified.

Copied 15 directory records, preserving id, display_name, client_type, business_name, email, phone and status. The destination has a primary key on id. Compared a full D1 readback against the ordered source snapshot: exact match for all 15 IDs and all seven columns, including nulls. No record values or credentials are included in this report.

Scope: one point-in-time snapshot. Not continuous replication, not a full CRM backup, and not a cutover. Jobs, tasks, notes, invoices, service packs, staff identities and sessions were not migrated. Supabase remains the sole system for live edits. Keep the staging database restricted to authorized Cloudflare administrators; remove it after the trial when no longer needed. Before attaching real records to any Worker, verify the Access policy denies an unapproved identity and use a separately authorized read-only route.

Follow-up: the operator confirmed an unapproved account was denied. The preview now has an authenticated GET-only /directory page backed by the separate rehearsal database. Only name and status are rendered; there is no snapshot JSON endpoint.
