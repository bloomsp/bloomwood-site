-- Directory rehearsal D1 only. Currency and quantity retain exact decimal text.
CREATE TABLE invoices (
 id TEXT NOT NULL PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id),
 invoice_number TEXT, status TEXT NOT NULL, external_provider TEXT, external_invoice_id TEXT,
 issued_at TEXT, paid_at TEXT, notes TEXT, total_amount TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE invoice_line_items (
 id TEXT NOT NULL PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id),
 source_type TEXT NOT NULL, job_id TEXT REFERENCES jobs(id), task_id TEXT REFERENCES tasks(id),
 service_pack_id TEXT REFERENCES service_packs(id), description TEXT NOT NULL,
 quantity TEXT, unit_amount TEXT, amount TEXT NOT NULL, sort_order INTEGER NOT NULL, created_at TEXT NOT NULL,
 CHECK ((source_type='job' AND job_id IS NOT NULL AND task_id IS NULL AND service_pack_id IS NULL)
 OR (source_type='task' AND task_id IS NOT NULL AND job_id IS NULL AND service_pack_id IS NULL)
 OR (source_type='service_pack' AND service_pack_id IS NOT NULL AND job_id IS NULL AND task_id IS NULL)
 OR (source_type='manual' AND job_id IS NULL AND task_id IS NULL AND service_pack_id IS NULL))
) STRICT;
CREATE INDEX rehearsal_invoice_client ON invoices(client_id);
CREATE INDEX rehearsal_line_invoice ON invoice_line_items(invoice_id);
