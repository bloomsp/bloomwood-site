CREATE TABLE deliveries (
 id TEXT PRIMARY KEY NOT NULL,job_id TEXT NOT NULL REFERENCES jobs(id),filename TEXT NOT NULL,
 size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 5242880),object_key TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('uploading','ready','revoked')),expires_at TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,changed_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
) STRICT;
CREATE TRIGGER delivery_created AFTER INSERT ON deliveries BEGIN
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('delivery',NEW.id,'create',NEW.version,NEW.changed_by,NEW.updated_at);
END;
CREATE TRIGGER delivery_updated AFTER UPDATE ON deliveries BEGIN
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('delivery',NEW.id,NEW.status,NEW.version,NEW.changed_by,NEW.updated_at);
END;
CREATE TABLE delivery_downloads(id INTEGER PRIMARY KEY,delivery_id TEXT NOT NULL REFERENCES deliveries(id),actor TEXT NOT NULL,created_at TEXT NOT NULL) STRICT;
