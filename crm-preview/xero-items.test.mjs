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
test('standalone product invoices need no job or task and preserve discounted totals',async()=>{
 const {t,f,j}=await productScenario();try{
 const count=f.db.prepare('SELECT count(*) n FROM tasks').get().n;
 const values={id:crypto.randomUUID(),version:'',client_id:j.client_id,item_ids:item,quantities:'2',discounts:'10'};
 assert.equal((await t.send('/sandbox/invoices/new',{...values,item_ids:''})).status,400);
 assert.equal((await t.send('/sandbox/invoices/new',{...values,discounts:'101'})).status,400);
 assert.equal((await t.send('/sandbox/invoices/new',values)).status,303);
 assert.equal(f.db.prepare('SELECT count(*) n FROM tasks').get().n,count);
 assert.equal(f.db.prepare('SELECT count(*) n FROM invoice_lines WHERE invoice_id=?').get(values.id).n,0);
 const products=f.db.prepare('SELECT * FROM all_invoice_products WHERE invoice_id=?').all(values.id);
 assert.equal(products.length,1);assert.equal(products[0].amount_cents,90000);assert.equal(products[0].task_id,null);
 assert.match(await (await f.request('/sandbox/invoices/'+values.id)).text(),/Total: \$900.00 AUD/);
 assert.match(await (await f.request('/sandbox/invoices')).text(),/\$900.00 AUD/);
 const payload=draftPayload(values,[],{},products);
 assert.equal(payload.Invoices[0].LineItems.length,1);assert.equal(payload.Invoices[0].LineItems[0].DiscountRate,10);
 assert.equal((await t.send('/sandbox/invoices/new',values)).status,409);
 f.db.prepare('UPDATE xero_items SET price_4=1').run();assert.equal(products[0].price_4,5000000);
 assert.equal((await t.send('/sandbox/invoices/'+values.id,{id:values.id,version:'1',status:'cancelled'})).status,303);
 }finally{f.db.close()}
});
test('standalone Xero pack sale activates saved allowance once, only after matching full payment',async()=>{
 const {t,f,j}=await productScenario();try{
 const id=crypto.randomUUID(),path='/sandbox/invoices/'+id+'/xero',service=f.db.prepare('SELECT id FROM service_types LIMIT 1').get().id;
 const values={...t.values,id};
 assert.equal((await t.send('/sandbox/invoices/new',{id,version:'',client_id:j.client_id,item_ids:item,quantities:'2',discounts:'10'})).status,303);
 assert.equal((await t.send(path,values)).status,409);
 const config='/sandbox/items/'+item+'/pack',settings={id:item,tenant_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',version:'0',service_type_id:service,hours:'5'};
 assert.equal((await f.request(config,new URLSearchParams(settings).toString(),{Origin:'https://evil.test'})).status,403);
 assert.equal((await t.send(config,settings)).status,303);
 const base=f.env.XERO_FETCH;let request,remote,putCount=0;
 f.env.XERO_FETCH=async(url,options={})=>{
 if(url.includes('/Items')&&options.headers['Xero-tenant-id']==='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')return Response.json({Items:[]});
 if(url.includes('/Invoices')){
 if(options.method==='PUT'){putCount++;request=JSON.parse(options.body).Invoices[0];remote={...request,InvoiceID:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',InvoiceNumber:'INV-PACK',Total:990,AmountDue:990};}
 return Response.json({Invoices:[remote]});
 }return base(url,options);
 };
 assert.equal((await t.send(path,values)).status,303);assert.equal(putCount,1);
 assert.equal(f.db.prepare('SELECT minutes FROM invoice_pack_grants WHERE invoice_id=?').get(id).minutes,600);
 assert.equal(f.db.prepare('SELECT count(*) n FROM service_packs WHERE invoice_source IS NOT NULL').get().n,0);
 assert.equal((await t.send(config,{...settings,version:'1',hours:'10'})).status,303);
 remote.Status='AUTHORISED';remote.AmountDue=100;
 const refresh=()=>t.send(path,{id,version:'1',action:'refresh'});
 assert.equal((await refresh()).status,303);assert.equal(f.db.prepare('SELECT count(*) n FROM service_packs WHERE invoice_source IS NOT NULL').get().n,0);
 remote.Status='PAID';remote.AmountDue=0;remote.LineItems[0].Quantity=3;
 await refresh();assert.match(f.db.prepare('SELECT pack_review FROM xero_exports WHERE invoice_id=?').get(id).pack_review,/needs review/);
 assert.equal(f.db.prepare('SELECT count(*) n FROM service_packs WHERE invoice_source IS NOT NULL').get().n,0);
 remote.LineItems[0].Quantity=2;
 assert.equal((await refresh()).status,303);assert.equal((await refresh()).status,303);
 const packs=f.db.prepare('SELECT * FROM service_packs WHERE invoice_source IS NOT NULL').all();assert.equal(packs.length,1);assert.equal(packs[0].purchased_minutes,600);assert.equal(packs[0].client_id,j.client_id);assert.equal(packs[0].service_type_id,service);assert.equal(putCount,1);
 assert.match(await (await f.request(path)).text(),/10 hours activated/);
 remote.Status='AUTHORISED';remote.AmountDue=990;await refresh();assert.match(f.db.prepare('SELECT pack_review FROM xero_exports WHERE invoice_id=?').get(id).pack_review,/Payment status changed/);
 assert.equal(f.db.prepare('SELECT purchased_minutes FROM service_packs WHERE invoice_source IS NOT NULL').get().purchased_minutes,600);
 }finally{f.db.close()}
});
