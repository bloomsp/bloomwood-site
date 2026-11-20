-- Directory rehearsal D1 only. Store exact Postgres decimals as text.
CREATE TABLE service_types (
 id TEXT NOT NULL PRIMARY KEY, slug TEXT, name TEXT, item_code TEXT, billing_mode TEXT,
 hourly_rate TEXT, billing_increment_minutes INTEGER, is_service_pack INTEGER CHECK (is_service_pack IN (0,1)),
 pack_hours TEXT, pack_price TEXT, active INTEGER CHECK (active IN (0,1)), sort_order INTEGER,
 created_at TEXT, updated_at TEXT
) STRICT;
CREATE TABLE service_packs (
 id TEXT NOT NULL PRIMARY KEY, client_id TEXT REFERENCES clients(id),
 service_type_id TEXT REFERENCES service_types(id), hours_purchased TEXT,
 minutes_purchased INTEGER, minutes_used INTEGER, purchase_price TEXT, purchase_date TEXT,
 expiry_date TEXT, status TEXT, notes TEXT, created_at TEXT, updated_at TEXT
) STRICT;
CREATE INDEX rehearsal_packs_client ON service_packs(client_id);
CREATE TABLE service_pack_usage (
 id TEXT NOT NULL PRIMARY KEY, service_pack_id TEXT REFERENCES service_packs(id),
 job_id TEXT REFERENCES jobs(id), minutes_applied INTEGER CHECK (minutes_applied > 0),
 notes TEXT, created_at TEXT, UNIQUE(service_pack_id, job_id)
) STRICT;
