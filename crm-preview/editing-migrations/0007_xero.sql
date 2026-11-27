CREATE TABLE xero_exports (
 invoice_id TEXT PRIMARY KEY REFERENCES invoices(id),tenant_id TEXT NOT NULL,request_json TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('submitting','uncertain','linked')),xero_invoice_id TEXT,xero_invoice_number TEXT,xero_status TEXT,xero_total REAL,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,changed_by TEXT NOT NULL
) STRICT;
CREATE UNIQUE INDEX unique_xero_invoice ON xero_exports(tenant_id,xero_invoice_id) WHERE xero_invoice_id IS NOT NULL;
CREATE TRIGGER xero_export_draft BEFORE INSERT ON xero_exports WHEN NOT EXISTS(SELECT 1 FROM invoices WHERE id=NEW.invoice_id AND status='draft') BEGIN SELECT RAISE(ABORT,'Only draft invoices may export'); END;
CREATE TRIGGER xero_controls_invoice BEFORE UPDATE ON invoices WHEN EXISTS(SELECT 1 FROM xero_exports WHERE invoice_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Manage exported invoices in Xero'); END;
CREATE TRIGGER xero_export_created AFTER INSERT ON xero_exports BEGIN
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('xero',NEW.invoice_id,NEW.state,1,NEW.changed_by,NEW.updated_at);
END;
CREATE TRIGGER xero_export_updated AFTER UPDATE ON xero_exports BEGIN
 INSERT INTO work_audit(entity,record_id,action,version,actor,changed_at) VALUES('xero',NEW.invoice_id,NEW.state,1,NEW.changed_by,NEW.updated_at);
END;
