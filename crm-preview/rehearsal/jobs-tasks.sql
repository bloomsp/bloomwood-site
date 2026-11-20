-- Apply only to the directory rehearsal database, not PREVIEW_DB or production.
CREATE TABLE jobs (
 id TEXT PRIMARY KEY NOT NULL,
 job_reference TEXT, client_id TEXT REFERENCES clients(id), title TEXT, category TEXT,
 status TEXT, priority TEXT, device_type TEXT, serial_number TEXT, intake_details TEXT,
 diagnosis TEXT, resolution_summary TEXT, opened_at TEXT, closed_at TEXT,
 created_at TEXT, updated_at TEXT, service_type_id TEXT, billable_minutes INTEGER,
 hourly_rate_snapshot TEXT, billing_increment_minutes_snapshot INTEGER,
 calculated_billable_amount TEXT, invoice_number TEXT, invoice_status TEXT, invoiced_at TEXT
) STRICT;
CREATE TABLE tasks (
 id TEXT PRIMARY KEY NOT NULL,
 client_id TEXT REFERENCES clients(id), job_id TEXT REFERENCES jobs(id), title TEXT,
 details TEXT, status TEXT, due_at TEXT, completed_at TEXT, created_by TEXT,
 created_at TEXT, updated_at TEXT, service_pack_id TEXT, time_taken_minutes INTEGER,
 billable_minutes INTEGER, non_billable_minutes INTEGER, service_type_id TEXT
) STRICT;
CREATE INDEX rehearsal_jobs_client ON jobs(client_id);
CREATE INDEX rehearsal_tasks_job ON tasks(job_id);
CREATE INDEX rehearsal_tasks_client ON tasks(client_id);
