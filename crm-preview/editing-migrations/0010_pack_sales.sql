CREATE TABLE pack_products (
 tenant_id TEXT NOT NULL,item_id TEXT NOT NULL,service_type_id TEXT NOT NULL REFERENCES service_types(id),
 minutes_per_unit INTEGER NOT NULL CHECK(minutes_per_unit BETWEEN 1 AND 1000000),
 version INTEGER NOT NULL DEFAULT 1,changed_by TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,item_id),FOREIGN KEY(tenant_id,item_id) REFERENCES xero_items(tenant_id,item_id)
) STRICT;
CREATE TABLE invoice_pack_grants (
 source_key TEXT PRIMARY KEY,invoice_id TEXT NOT NULL REFERENCES invoices(id),service_type_id TEXT NOT NULL REFERENCES service_types(id),
 name TEXT NOT NULL,minutes INTEGER NOT NULL CHECK(minutes BETWEEN 1 AND 1000000)
) STRICT;
ALTER TABLE service_packs ADD COLUMN invoice_source TEXT;
CREATE UNIQUE INDEX pack_invoice_source ON service_packs(invoice_source) WHERE invoice_source IS NOT NULL;
ALTER TABLE xero_exports ADD COLUMN pack_review TEXT;
CREATE TRIGGER export_pack_snapshot AFTER INSERT ON xero_exports BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM all_invoice_products p LEFT JOIN pack_products m ON m.tenant_id=p.tenant_id AND m.item_id=p.item_id WHERE p.invoice_id=NEW.invoice_id AND p.is_pack=1 AND (m.item_id IS NULL OR (p.quantity_4*m.minutes_per_unit)%10000!=0 OR p.quantity_4*m.minutes_per_unit/10000 NOT BETWEEN 1 AND 1000000)) THEN RAISE(ABORT,'Configure pack hours before exporting') END;
 INSERT INTO invoice_pack_grants(source_key,invoice_id,service_type_id,name,minutes)
 SELECT NEW.invoice_id||'|'||coalesce(p.task_id,'direct')||'|'||p.item_line_id,NEW.invoice_id,m.service_type_id,substr(p.code||' — '||p.name,1,200),p.quantity_4*m.minutes_per_unit/10000
 FROM all_invoice_products p JOIN pack_products m ON m.tenant_id=p.tenant_id AND m.item_id=p.item_id WHERE p.invoice_id=NEW.invoice_id AND p.is_pack=1;
END;
CREATE TRIGGER invoice_pack_grant_immutable BEFORE UPDATE ON invoice_pack_grants BEGIN SELECT RAISE(ABORT,'Pack sale snapshot is immutable'); END;
