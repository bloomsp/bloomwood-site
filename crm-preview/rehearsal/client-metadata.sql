-- Directory rehearsal database only. Tags preserve null vs JSON [].
ALTER TABLE clients ADD COLUMN address TEXT;
ALTER TABLE clients ADD COLUMN preferred_contact_method TEXT;
ALTER TABLE clients ADD COLUMN tags TEXT CHECK(tags IS NULL OR (json_valid(tags) AND json_type(tags)='array'));
ALTER TABLE clients ADD COLUMN created_at TEXT;
ALTER TABLE clients ADD COLUMN updated_at TEXT;
ALTER TABLE clients ADD COLUMN first_name TEXT;
ALTER TABLE clients ADD COLUMN last_name TEXT;
ALTER TABLE clients ADD COLUMN contact_name TEXT;
ALTER TABLE clients ADD COLUMN contact_role TEXT;
ALTER TABLE clients ADD COLUMN date_of_birth TEXT;
CREATE TABLE job_notes (
 id TEXT PRIMARY KEY NOT NULL, client_id TEXT REFERENCES clients(id), job_id TEXT REFERENCES jobs(id),
 note_type TEXT, body TEXT, created_by TEXT, created_at TEXT
) STRICT;
CREATE TABLE file_deliveries (
 id TEXT PRIMARY KEY NOT NULL, job_id TEXT REFERENCES jobs(id), delivery_type TEXT, status TEXT,
 download_job_id TEXT, notes TEXT, created_at TEXT, updated_at TEXT
) STRICT;
CREATE INDEX rehearsal_notes_client ON job_notes(client_id);
CREATE INDEX rehearsal_notes_job ON job_notes(job_id);
CREATE INDEX rehearsal_deliveries_job ON file_deliveries(job_id);
