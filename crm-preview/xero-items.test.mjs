import {productScenario} from '../tests/helpers/product-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {xeroFixture} from '../tests/helpers/xero-fixture.mjs';
import {itemAmount,isPack} from './xero-items.mjs';
import {draftPayload} from './xero-invoices.mjs';
const item='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
test('live catalogue import is read-only; products and discounts snapshot into invoices',async()=>{
 const {t,f,task,j,path}=await productScenario();try{
 const values={id:task.id,version:'1',action:'add',item_id:item,quantity:'2',discount:'10',line_id:''};
 assert.equal((await t.send(path,values)).status,303);assert.equal((await t.send(path,values)).status,409);
 const line=f.db.prepare('SELECT * FROM task_items WHERE task_id=?').get(task.id);assert.equal(line.amount_cents,90000);assert.equal(line.is_pack,1);
 assert.match(await (await f.request('/sandbox/jobs/'+j.id+'/edit')).text(),/Total to be billed: \$900\.00 AUD/);
 assert.equal((await t.send(path,{...values,version:'2',discount:'100.01'})).status,400);
 const invoice={id:crypto.randomUUID(),version:'',client_id:j.client_id,task_ids:task.id};
 assert.equal((await t.send('/sandbox/invoices/new',invoice)).status,303);
 const lines=f.db.prepare('SELECT * FROM invoice_lines WHERE invoice_id=?').all(invoice.id),products=f.db.prepare('SELECT * FROM invoice_item_lines WHERE invoice_id=?').all(invoice.id);
 assert.equal(lines[0].amount_cents,90000);
 const payload=draftPayload(invoice,lines,{contact_id:'contact',amount_type:'Exclusive',account_code:'200',tax_type:'OUTPUT'},products,'demo',new Set());
 assert.equal(payload.Invoices[0].LineItems.length,1);assert.equal(payload.Invoices[0].LineItems[0].DiscountRate,10);assert.equal(payload.Invoices[0].LineItems[0].UnitAmount,500);assert.equal(payload.Invoices[0].LineItems[0].Quantity,2);assert.equal(payload.Invoices[0].LineItems[0].ItemCode,undefined);assert.match(payload.Invoices[0].LineItems[0].Description,/SPack-5/);
 const matched=draftPayload(invoice,lines,{},products,'demo',new Set(['SPack-5']));assert.equal(matched.Invoices[0].LineItems[0].ItemCode,'SPack-5');
 assert.equal((await t.send(path,{...values,version:'2',action:'remove',line_id:line.id})).status,409);
 f.db.prepare('UPDATE xero_items SET price_4=1000000').run();assert.equal(f.db.prepare('SELECT price_4 FROM invoice_item_lines WHERE invoice_id=?').get(invoice.id).price_4,5000000);
 }finally{f.db.close()}
});
test('product discounts round in integer arithmetic and recognise SPack anywhere',()=>{
 assert.equal(itemAmount(10000,1000000,10000),0);assert.equal(itemAmount(15000,1255000,1250),16472);assert.ok(isPack('IT-SPack-10'));assert.ok(isPack('spack'));assert.equal(isPack('repair'),false);
});
