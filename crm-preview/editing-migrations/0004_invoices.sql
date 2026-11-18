CREATE VIEW task_billing AS
SELECT t.*,s.hourly_rate_cents,
 CASE WHEN t.status='cancelled' THEN 0 ELSE t.billable_minutes END AS eligible_minutes,
 CASE WHEN t.status='cancelled' OR p.id IS NULL THEN 0 ELSE min(t.billable_minutes,max(0,p.purchased_minutes-coalesce(sum(CASE WHEN t.status!='cancelled' THEN t.billable_minutes ELSE 0 END) OVER (PARTITION BY t.service_pack_id ORDER BY t.created_at,t.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0))) END AS covered_minutes
FROM tasks t LEFT JOIN service_packs p ON p.id=t.service_pack_id LEFT JOIN service_types s ON s.id=t.service_type_id;
CREATE TABLE invoices (
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id), client_name TEXT NOT NULL,
 selection TEXT NOT NULL CHECK(json_valid(selection)), status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','paid','cancelled')),
 version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, issued_at TEXT, paid_at TEXT, changed_by TEXT NOT NULL
) STRICT;
CREATE TABLE invoice_lines (
 invoice_id TEXT NOT NULL REFERENCES invoices(id), task_id TEXT NOT NULL REFERENCES tasks(id),
 title TEXT NOT NULL, service_pack_id TEXT, billable_minutes INTEGER NOT NULL, covered_minutes INTEGER NOT NULL,
 hourly_rate_cents INTEGER NOT NULL, amount_cents INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(invoice_id,task_id)
) STRICT;
CREATE UNIQUE INDEX invoice_task_claim ON invoice_lines(task_id) WHERE active=1;
CREATE TRIGGER invoice_create BEFORE INSERT ON invoices BEGIN
 SELECT CASE WHEN NEW.status!='draft' OR json_array_length(NEW.selection)=0 OR json_array_length(NEW.selection)>100 THEN RAISE(ABORT,'Invalid selection') END;
 SELECT CASE WHEN (SELECT count(*) FROM task_billing WHERE id IN (SELECT value FROM json_each(NEW.selection)) AND client_id=NEW.client_id AND status='done' AND hourly_rate_cents IS NOT NULL AND eligible_minutes>covered_minutes)!=json_array_length(NEW.selection) THEN RAISE(ABORT,'Select completed priced tasks with uncovered time') END;
END;
CREATE TRIGGER invoice_created AFTER INSERT ON invoices BEGIN
 INSERT INTO invoice_lines(invoice_id,task_id,title,service_pack_id,billable_minutes,covered_minutes,hourly_rate_cents,amount_cents)
 SELECT NEW.id,id,title,service_pack_id,eligible_minutes,covered_minutes,hourly_rate_cents,CAST(round((eligible_minutes-covered_minutes)*hourly_rate_cents/60.0) AS INTEGER) FROM task_billing WHERE id IN (SELECT value FROM json_each(NEW.selection));
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('invoice',NEW.id,'create',NEW.version,NEW.changed_by,NEW.updated_at);
END;
CREATE TRIGGER invoice_transition BEFORE UPDATE ON invoices BEGIN
 SELECT CASE WHEN NEW.id!=OLD.id OR NEW.client_id!=OLD.client_id OR NEW.client_name!=OLD.client_name OR NEW.selection!=OLD.selection OR NEW.created_at!=OLD.created_at OR NEW.version!=OLD.version+1 THEN RAISE(ABORT,'Invoice snapshot is immutable') END;
 SELECT CASE WHEN NOT ((OLD.status='draft' AND NEW.status IN ('issued','cancelled')) OR (OLD.status='issued' AND NEW.status IN ('paid','cancelled'))) THEN RAISE(ABORT,'Invalid invoice transition') END;
END;
CREATE TRIGGER invoice_updated AFTER UPDATE ON invoices BEGIN
 UPDATE invoice_lines SET active=0 WHERE invoice_id=NEW.id AND NEW.status='cancelled';
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('invoice',NEW.id,NEW.status,NEW.version,NEW.changed_by,NEW.updated_at);
END;
CREATE TRIGGER invoiced_task_lock BEFORE UPDATE ON tasks WHEN EXISTS(SELECT 1 FROM invoice_lines WHERE active=1 AND (task_id=OLD.id OR service_pack_id=OLD.service_pack_id OR service_pack_id=NEW.service_pack_id)) BEGIN
 SELECT RAISE(ABORT,'Cancel the invoice before changing this task or shared pack allocation');
END;
CREATE TRIGGER invoiced_pack_lock BEFORE UPDATE OF purchased_minutes ON service_packs WHEN NEW.purchased_minutes!=OLD.purchased_minutes AND EXISTS(SELECT 1 FROM invoice_lines WHERE active=1 AND service_pack_id=OLD.id) BEGIN
 SELECT RAISE(ABORT,'Cancel the invoice before changing its pack allowance');
END;
CREATE TRIGGER invoiced_pack_insert_lock BEFORE INSERT ON tasks WHEN EXISTS(SELECT 1 FROM invoice_lines WHERE active=1 AND service_pack_id=NEW.service_pack_id) BEGIN
 SELECT RAISE(ABORT,'Pack is reserved by an invoice');
END;
