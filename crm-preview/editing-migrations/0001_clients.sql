-- Fictional editing sandbox only; never apply to the rehearsal database.
CREATE TABLE clients (
 id TEXT PRIMARY KEY NOT NULL,
 display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 200),
 client_type TEXT NOT NULL CHECK(client_type IN ('person','company')),
 first_name TEXT, last_name TEXT, business_name TEXT, contact_name TEXT, contact_role TEXT,
 date_of_birth TEXT, email TEXT, phone TEXT, address TEXT,
 preferred_contact_method TEXT NOT NULL CHECK(preferred_contact_method IN ('email','phone','sms','other')),
 status TEXT NOT NULL CHECK(status IN ('active','lead','inactive','archived')),
 tags TEXT NOT NULL CHECK(json_valid(tags) AND json_type(tags)='array'),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 changed_by TEXT NOT NULL,
 CHECK ((client_type='person' AND (length(coalesce(first_name,''))>0 OR length(coalesce(last_name,''))>0))
 OR (client_type='company' AND length(coalesce(business_name,''))>0))
) STRICT;
CREATE TABLE client_audit (
 sequence INTEGER PRIMARY KEY,
 client_id TEXT NOT NULL REFERENCES clients(id),
 action TEXT NOT NULL, version INTEGER NOT NULL,
 actor TEXT NOT NULL, changed_at TEXT NOT NULL
) STRICT;
CREATE TRIGGER client_created AFTER INSERT ON clients BEGIN
 INSERT INTO client_audit(client_id,action,version,actor,changed_at)
 VALUES (NEW.id,'create',NEW.version,NEW.changed_by,NEW.updated_at);
END;
CREATE TRIGGER client_edited AFTER UPDATE ON clients BEGIN
 INSERT INTO client_audit(client_id,action,version,actor,changed_at)
 VALUES (NEW.id,'edit',NEW.version,NEW.changed_by,NEW.updated_at);
END;
INSERT INTO clients(id,display_name,client_type,business_name,preferred_contact_method,status,tags,created_at,updated_at,changed_by)
VALUES('11111111-1111-4111-8111-111111111111','Fictional Fern Studio','company','Fictional Fern Studio','email','active','[]','2026-11-18T00:00:00Z','2026-11-18T00:00:00Z','sandbox-seed');
