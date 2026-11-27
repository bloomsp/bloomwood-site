CREATE TABLE xero_items (
 tenant_id TEXT NOT NULL,item_id TEXT NOT NULL,code TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL,
 price_4 INTEGER,account_code TEXT,tax_type TEXT,is_pack INTEGER NOT NULL,active INTEGER NOT NULL,synced_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,item_id),UNIQUE(tenant_id,code)
) STRICT;
CREATE TABLE task_items (
 id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),tenant_id TEXT NOT NULL,item_id TEXT NOT NULL,
 code TEXT NOT NULL,name TEXT NOT NULL,quantity_4 INTEGER NOT NULL CHECK(quantity_4 BETWEEN 1 AND 100000000),
 price_4 INTEGER NOT NULL CHECK(price_4 BETWEEN 0 AND 10000000000),discount_bps INTEGER NOT NULL CHECK(discount_bps BETWEEN 0 AND 10000),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),is_pack INTEGER NOT NULL,changed_by TEXT NOT NULL,created_at TEXT NOT NULL
) STRICT;
CREATE INDEX task_items_task ON task_items(task_id);
CREATE TABLE invoice_item_lines (
 invoice_id TEXT NOT NULL REFERENCES invoices(id),item_line_id TEXT NOT NULL,task_id TEXT NOT NULL,
 tenant_id TEXT NOT NULL,item_id TEXT NOT NULL,code TEXT NOT NULL,name TEXT NOT NULL,quantity_4 INTEGER NOT NULL,
 price_4 INTEGER NOT NULL,discount_bps INTEGER NOT NULL,amount_cents INTEGER NOT NULL,is_pack INTEGER NOT NULL,
 PRIMARY KEY(invoice_id,item_line_id)
) STRICT;
CREATE TRIGGER task_item_insert BEFORE INSERT ON task_items WHEN NOT EXISTS(SELECT 1 FROM tasks t JOIN jobs j ON j.id=t.job_id WHERE t.id=NEW.task_id AND j.status IN ('open','in_progress') AND t.service_pack_id IS NULL) OR EXISTS(SELECT 1 FROM invoice_lines WHERE task_id=NEW.task_id AND active=1) BEGIN SELECT RAISE(ABORT,'Task is closed, invoiced or uses a pack'); END;
CREATE TRIGGER task_item_delete BEFORE DELETE ON task_items WHEN EXISTS(SELECT 1 FROM invoice_lines WHERE task_id=OLD.task_id AND active=1) OR NOT EXISTS(SELECT 1 FROM tasks t JOIN jobs j ON j.id=t.job_id WHERE t.id=OLD.task_id AND j.status IN ('open','in_progress')) BEGIN SELECT RAISE(ABORT,'Task is closed or invoiced'); END;
CREATE TRIGGER task_item_immutable BEFORE UPDATE ON task_items BEGIN SELECT RAISE(ABORT,'Remove and replace item'); END;
CREATE TRIGGER task_item_added AFTER INSERT ON task_items BEGIN UPDATE tasks SET version=version+1,changed_by=NEW.changed_by,updated_at=NEW.created_at WHERE id=NEW.task_id; END;
CREATE TRIGGER task_item_removed AFTER DELETE ON task_items BEGIN UPDATE tasks SET version=version+1 WHERE id=OLD.task_id; END;
CREATE TRIGGER item_task_no_pack BEFORE UPDATE OF service_pack_id ON tasks WHEN NEW.service_pack_id IS NOT NULL AND EXISTS(SELECT 1 FROM task_items WHERE task_id=NEW.id) BEGIN SELECT RAISE(ABORT,'Item charges cannot consume a service pack'); END;
DROP TRIGGER invoice_create;
CREATE TRIGGER invoice_create BEFORE INSERT ON invoices BEGIN
 SELECT CASE WHEN NEW.status!='draft' OR json_array_length(NEW.selection)=0 OR json_array_length(NEW.selection)>100 THEN RAISE(ABORT,'Invalid selection') END;
 SELECT CASE WHEN (SELECT count(*) FROM task_billing t WHERE id IN (SELECT value FROM json_each(NEW.selection)) AND client_id=NEW.client_id AND status='done' AND ((hourly_rate_cents IS NOT NULL AND eligible_minutes>covered_minutes) OR EXISTS(SELECT 1 FROM task_items WHERE task_id=t.id)))!=json_array_length(NEW.selection) THEN RAISE(ABORT,'Select completed priced tasks') END;
END;
DROP TRIGGER invoice_created;
CREATE TRIGGER invoice_created AFTER INSERT ON invoices BEGIN
 INSERT INTO invoice_lines(invoice_id,task_id,title,service_pack_id,billable_minutes,covered_minutes,hourly_rate_cents,amount_cents)
 SELECT NEW.id,t.id,t.title,t.service_pack_id,t.eligible_minutes,t.covered_minutes,coalesce(t.hourly_rate_cents,0),coalesce((SELECT sum(amount_cents) FROM task_items WHERE task_id=t.id),CAST(round((eligible_minutes-covered_minutes)*hourly_rate_cents/60.0) AS INTEGER)) FROM task_billing t WHERE id IN (SELECT value FROM json_each(NEW.selection));
 INSERT INTO invoice_item_lines SELECT NEW.id,id,task_id,tenant_id,item_id,code,name,quantity_4,price_4,discount_bps,amount_cents,is_pack FROM task_items WHERE task_id IN (SELECT value FROM json_each(NEW.selection));
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('invoice',NEW.id,'create',NEW.version,NEW.changed_by,NEW.updated_at);
END;
