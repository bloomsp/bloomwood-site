CREATE TABLE jobs (
 id TEXT PRIMARY KEY NOT NULL,
 client_id TEXT NOT NULL REFERENCES clients(id),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
 details TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('open','in_progress','completed','cancelled')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 closed_at TEXT, version INTEGER NOT NULL DEFAULT 1, changed_by TEXT NOT NULL,
 UNIQUE(id,client_id), CHECK(version>0)
) STRICT;
CREATE TABLE tasks (
 id TEXT PRIMARY KEY NOT NULL,
 job_id TEXT NOT NULL, client_id TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
 details TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('open','done','cancelled')),
 billable_minutes INTEGER NOT NULL CHECK(billable_minutes BETWEEN 0 AND 1000000),
 non_billable_minutes INTEGER NOT NULL CHECK(non_billable_minutes BETWEEN 0 AND 1000000),
 time_taken_minutes INTEGER GENERATED ALWAYS AS (billable_minutes+non_billable_minutes) STORED,
 completed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), changed_by TEXT NOT NULL,
 FOREIGN KEY(job_id,client_id) REFERENCES jobs(id,client_id),
 CHECK((status='done' AND completed_at IS NOT NULL) OR (status!='done' AND completed_at IS NULL))
) STRICT;
CREATE INDEX tasks_job ON tasks(job_id);
CREATE INDEX jobs_client ON jobs(client_id);
CREATE TABLE work_audit (
 sequence INTEGER PRIMARY KEY, entity TEXT NOT NULL, record_id TEXT NOT NULL,
 action TEXT NOT NULL, version INTEGER NOT NULL, actor TEXT NOT NULL, changed_at TEXT NOT NULL
) STRICT;
CREATE TRIGGER jobs_created AFTER INSERT ON jobs BEGIN
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('job',NEW.id,'create',NEW.version,NEW.changed_by,NEW.updated_at);
END;
CREATE TRIGGER jobs_edited AFTER UPDATE ON jobs BEGIN
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('job',NEW.id,'edit',NEW.version,NEW.changed_by,NEW.updated_at);
END;
CREATE TRIGGER tasks_created AFTER INSERT ON tasks BEGIN
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('task',NEW.id,'create',NEW.version,NEW.changed_by,NEW.updated_at);
END;
CREATE TRIGGER tasks_edited AFTER UPDATE ON tasks BEGIN
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('task',NEW.id,'edit',NEW.version,NEW.changed_by,NEW.updated_at);
END;
CREATE TRIGGER job_client_immutable BEFORE UPDATE OF client_id ON jobs WHEN NEW.client_id!=OLD.client_id BEGIN
 SELECT RAISE(ABORT,'Job client cannot be changed');
END;
CREATE TRIGGER task_parent_immutable BEFORE UPDATE OF job_id,client_id ON tasks WHEN NEW.job_id!=OLD.job_id OR NEW.client_id!=OLD.client_id BEGIN
 SELECT RAISE(ABORT,'Task parent cannot be changed');
END;
CREATE TRIGGER task_closed_job_insert BEFORE INSERT ON tasks WHEN (SELECT status FROM jobs WHERE id=NEW.job_id) IN ('completed','cancelled') BEGIN
 SELECT RAISE(ABORT,'Reopen job before adding tasks');
END;
CREATE TRIGGER task_closed_job_update BEFORE UPDATE ON tasks WHEN (SELECT status FROM jobs WHERE id=NEW.job_id) IN ('completed','cancelled') BEGIN
 SELECT RAISE(ABORT,'Reopen job before editing tasks');
END;
CREATE TRIGGER job_open_tasks BEFORE UPDATE OF status ON jobs WHEN NEW.status IN ('completed','cancelled') AND EXISTS(SELECT 1 FROM tasks WHERE job_id=NEW.id AND status='open') BEGIN
 SELECT RAISE(ABORT,'Finish or cancel open tasks before closing job');
END;
