import assert from 'node:assert/strict';
import {verifyServices} from './service-scenario.mjs';
export async function verifyInvoices(f){
 const {service,pack,tasks}=await verifyServices(f),t=tasks[1];
 const send=(path,v)=>f.request(path,new URLSearchParams(v).toString());
 assert.equal((await send('/sandbox/tasks/'+t.id+'/edit',{...t,version:'3',status:'done'})).status,303);
 const invoice={id:crypto.randomUUID(),version:'',client_id:pack.client_id,task_ids:t.id},path='/sandbox/invoices/'+invoice.id;
 const results=await Promise.all([send('/sandbox/invoices/new',invoice),send('/sandbox/invoices/new',{...invoice,id:crypto.randomUUID()})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[303,409]);
 const location=results.find(r=>r.status===303).headers.get('location').replace(/\/xero$/,''),savedId=location.split('/').pop();
 assert.match(await (await f.request(location)).text(),/Total: \$94\.13 AUD/);
 assert.equal((await send('/sandbox/services/'+service.id+'/edit',{...service,version:'1',hourly_rate:'200'})).status,303);
 assert.match(await (await f.request(location)).text(),/Total: \$94\.13 AUD/);
 assert.equal((await send('/sandbox/tasks/'+t.id+'/edit',{...t,version:'4',status:'done'})).status,409);
 assert.equal((await send(location,{id:savedId,version:'1',status:'issued'})).status,400);
 assert.equal((await send(location,{id:savedId,version:'1',status:'cancelled'})).status,303);
 assert.equal((await send(location,{id:savedId,version:'1',status:'cancelled'})).status,409);
 const next={...invoice,id:crypto.randomUUID()};
 assert.equal((await send('/sandbox/invoices/new',next)).status,303);
 const nextPath='/sandbox/invoices/'+next.id;
 assert.match(await (await f.request(nextPath)).text(),/Total: \$150\.00 AUD/);
 assert.equal((await send(nextPath,{id:next.id,version:'1',status:'paid'})).status,400);
 return {task:t,invoiceId:next.id};
}
