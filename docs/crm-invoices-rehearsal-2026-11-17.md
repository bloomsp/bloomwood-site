# Invoices rehearsal — 17 November 2026

Copied one read-only Supabase snapshot into the isolated directory rehearsal D1 database: 10 invoice headers and 11 invoice lines. All 12 columns of each table, including IDs, nulls and exact decimal values, matched on ordered readback. Currency and quantities are stored as decimal text.

Recomputed each header total from its stored line amounts using integer cents on both the source snapshot and D1 readback. All ten invoices balanced. Every invoice resolved to a staged client. The ten job lines and one task line resolved to staged records belonging to the same client as the invoice. No manual or service-pack lines occurred in this snapshot. D1 foreign_key_check was clean and the Supabase snapshot fingerprint was unchanged after import.

No production writes, new routes, preview deployment or billing changes were made. These reconciliation checks verify an historical copy, not production editing behavior. D1 does not yet implement the Postgres triggers for live billing. No invoice data or client identifiers are in this report.
