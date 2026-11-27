CREATE TABLE service_types (
 id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 hourly_rate_cents INTEGER NOT NULL CHECK(hourly_rate_cents BETWEEN 0 AND 100000000),
 version INTEGER NOT NULL DEFAULT 1, changed_by TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE service_packs (
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id),
 service_type_id TEXT NOT NULL REFERENCES service_types(id),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 purchased_minutes INTEGER NOT NULL CHECK(purchased_minutes BETWEEN 0 AND 1000000),
 version INTEGER NOT NULL DEFAULT 1, changed_by TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
ALTER TABLE tasks ADD COLUMN service_type_id TEXT REFERENCES service_types(id);
ALTER TABLE tasks ADD COLUMN service_pack_id TEXT REFERENCES service_packs(id);
CREATE INDEX tasks_pack ON tasks(service_pack_id);
CREATE TRIGGER pack_links_immutable BEFORE UPDATE ON service_packs WHEN NEW.client_id!=OLD.client_id OR NEW.service_type_id!=OLD.service_type_id BEGIN
 SELECT RAISE(ABORT,'Pack client and service cannot change');
END;
CREATE TRIGGER task_service_insert BEFORE INSERT ON tasks WHEN NEW.service_pack_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM service_packs WHERE id=NEW.service_pack_id AND client_id=NEW.client_id AND service_type_id=NEW.service_type_id) BEGIN
 SELECT RAISE(ABORT,'Pack must match task client and service');
END;
CREATE TRIGGER task_service_update BEFORE UPDATE ON tasks WHEN NEW.service_pack_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM service_packs WHERE id=NEW.service_pack_id AND client_id=NEW.client_id AND service_type_id=NEW.service_type_id) BEGIN
 SELECT RAISE(ABORT,'Pack must match task client and service');
END;
CREATE TRIGGER service_created AFTER INSERT ON service_types BEGIN
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('service',NEW.id,'create',NEW.version,NEW.changed_by,NEW.updated_at);
END;
CREATE TRIGGER service_edited AFTER UPDATE ON service_types BEGIN
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('service',NEW.id,'edit',NEW.version,NEW.changed_by,NEW.updated_at);
END;
CREATE TRIGGER pack_created AFTER INSERT ON service_packs BEGIN
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('pack',NEW.id,'create',NEW.version,NEW.changed_by,NEW.updated_at);
END;
CREATE TRIGGER pack_edited AFTER UPDATE ON service_packs BEGIN
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('pack',NEW.id,'edit',NEW.version,NEW.changed_by,NEW.updated_at);
END;
