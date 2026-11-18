import test from 'node:test';
import assert from 'node:assert/strict';
import {editingFixture} from '../tests/helpers/editing-fixture.mjs';
import {verifyInvoices} from '../tests/helpers/invoice-scenario.mjs';
test('invoice snapshots, atomic duplicate prevention, cancellation release and status lifecycle',async()=>{
 const f=await editingFixture();try{
 const {invoiceId,task}=await verifyInvoices(f);
 for(const path of ['/sandbox/tasks/'+task.id+'/edit','/sandbox/allocations/'+task.id]){
 const response=await f.request(path);assert.equal(response.status,409);
 const html=await response.text();assert.ok(html.includes('href="/sandbox/invoices/'+invoiceId+'"'));assert.match(html,/Status: paid/);
 }
 const job=f.db.prepare('SELECT job_id FROM tasks WHERE id=?').get(task.id);
 assert.match(await (await f.request('/sandbox/jobs/'+job.job_id+'/edit')).text(),/Total to be billed: \$0\.00 AUD/);
 const row=f.db.prepare('SELECT * FROM invoices WHERE id=?').get(invoiceId);
 assert.ok(row.issued_at);assert.ok(row.paid_at);
 assert.equal(f.db.prepare("SELECT count(*) n FROM work_audit WHERE entity='invoice'").get().n,6);
 assert.equal(f.db.prepare('SELECT count(*) n FROM invoice_lines WHERE active=1').get().n,1);
 }finally{f.db.close()}
});
test('invoice writes require verified identity and same origin',async()=>{
 const f=await editingFixture();try{
 for(const path of ['/sandbox/invoices/new','/sandbox/invoices/11111111-1111-4111-8111-111111111111']){
 assert.equal((await f.request(path,'x=1',{Origin:'https://evil.example'})).status,403);
 assert.equal((await f.request(path,'x=1',{'Cf-Access-Jwt-Assertion':''})).status,401);
 assert.equal((await f.request(path,'x=1',{},'DELETE')).status,405);
 }assert.equal(f.calls(),0);
 }finally{f.db.close()}
});
test('invoice creation rolls back wholly on invalid selection and audit failure',async()=>{
 const f=await editingFixture();try{
 const {verifyServices}=await import('../tests/helpers/service-scenario.mjs');
 const {pack,tasks}=await verifyServices(f),t=tasks[1];
 const send=(p,v)=>f.request(p,new URLSearchParams(v).toString());
 const value={id:crypto.randomUUID(),version:'',client_id:pack.client_id,task_ids:t.id};
 assert.equal((await send('/sandbox/invoices/new',value)).status,409); // still open
 assert.equal((await send('/sandbox/tasks/'+t.id+'/edit',{...t,version:'3',status:'done'})).status,303);
 const mixed=new URLSearchParams(value);mixed.append('task_ids',tasks[0].id); // cancelled task
 assert.equal((await f.request('/sandbox/invoices/new',mixed.toString())).status,409);
 assert.equal(f.db.prepare('SELECT count(*) n FROM invoices').get().n,0);
 assert.equal(f.db.prepare('SELECT count(*) n FROM invoice_lines').get().n,0);
 f.db.exec("CREATE TRIGGER fail_invoice_audit BEFORE INSERT ON work_audit WHEN NEW.entity='invoice' BEGIN SELECT RAISE(ABORT,'audit failed'); END;");
 assert.equal((await send('/sandbox/invoices/new',value)).status,409);
 assert.equal(f.db.prepare('SELECT count(*) n FROM invoices').get().n,0);
 assert.equal(f.db.prepare('SELECT count(*) n FROM invoice_lines').get().n,0);
 }finally{f.db.close()}
});
