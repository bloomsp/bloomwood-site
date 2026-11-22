ALTER TABLE invoices ADD COLUMN product_selection TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(product_selection));
CREATE TABLE invoice_direct_lines (
 invoice_id TEXT NOT NULL REFERENCES invoices(id),item_line_id TEXT NOT NULL,task_id TEXT,
 tenant_id TEXT NOT NULL,item_id TEXT NOT NULL,code TEXT NOT NULL,name TEXT NOT NULL,
 quantity_4 INTEGER NOT NULL CHECK(quantity_4 BETWEEN 1 AND 100000000),price_4 INTEGER NOT NULL CHECK(price_4 BETWEEN 0 AND 10000000000),
 discount_bps INTEGER NOT NULL CHECK(discount_bps BETWEEN 0 AND 10000),amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),is_pack INTEGER NOT NULL,
 PRIMARY KEY(invoice_id,item_line_id)
) STRICT;
DROP TRIGGER invoice_create;
CREATE TRIGGER invoice_create BEFORE INSERT ON invoices BEGIN
 SELECT CASE WHEN NEW.status!='draft' OR (json_array_length(NEW.selection)=0 AND json_array_length(NEW.product_selection)=0) OR json_array_length(NEW.selection)>100 THEN RAISE(ABORT,'Invalid selection') END;
 SELECT CASE WHEN (SELECT count(*) FROM task_billing t WHERE id IN (SELECT value FROM json_each(NEW.selection)) AND client_id=NEW.client_id AND status='done' AND ((hourly_rate_cents IS NOT NULL AND eligible_minutes>covered_minutes) OR EXISTS(SELECT 1 FROM task_items WHERE task_id=t.id)))!=json_array_length(NEW.selection) THEN RAISE(ABORT,'Select completed priced tasks') END;
END;

CREATE TRIGGER invoice_direct_created AFTER INSERT ON invoices BEGIN
 INSERT INTO invoice_direct_lines SELECT NEW.id,CAST(key AS TEXT),NULL,
 json_extract(value,'$.tenant_id'),json_extract(value,'$.item_id'),json_extract(value,'$.code'),json_extract(value,'$.name'),
 json_extract(value,'$.quantity_4'),json_extract(value,'$.price_4'),json_extract(value,'$.discount_bps'),json_extract(value,'$.amount_cents'),json_extract(value,'$.is_pack') FROM json_each(NEW.product_selection);
END;
CREATE TRIGGER invoice_product_selection_lock BEFORE UPDATE OF product_selection ON invoices BEGIN SELECT RAISE(ABORT,'Invoice products are immutable'); END;
CREATE TRIGGER direct_line_update_lock BEFORE UPDATE ON invoice_direct_lines BEGIN SELECT RAISE(ABORT,'Invoice products are immutable'); END;
CREATE TRIGGER direct_line_delete_lock BEFORE DELETE ON invoice_direct_lines BEGIN SELECT RAISE(ABORT,'Invoice products are immutable'); END;
CREATE VIEW all_invoice_products AS SELECT * FROM invoice_item_lines UNION ALL SELECT * FROM invoice_direct_lines;
