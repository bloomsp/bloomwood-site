import {verifyServices} from '../tests/helpers/service-scenario.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {editingFixture} from '../tests/helpers/editing-fixture.mjs';
import {allocation} from './service-editor.mjs';
test('allocation orders tasks deterministically, excludes cancelled time and caps coverage',()=>{
 const rows=allocation([{id:'b',created_at:'2026',status:'done',billable_minutes:45},{id:'a',created_at:'2026',status:'open',billable_minutes:45},{id:'c',created_at:'2027',status:'cancelled',billable_minutes:90}],60);
 assert.deepEqual(rows.map(r=>[r.id,r.covered,r.overflow,r.remaining]),[['a',45,0,15],['b',15,30,0],['c',0,0,0]]);
 assert.equal(allocation(rows,0).reduce((s,t)=>s+t.overflow,0),90);
});
test('services and packs validate rates, protect edits and recalculate allocation balances',async()=>{const f=await editingFixture();try{
 const {service,pack,tasks}=await verifyServices(f);
 assert.equal(f.db.prepare('SELECT hourly_rate_cents FROM service_types WHERE id=?').get(service.id).hourly_rate_cents,12550);
 assert.throws(()=>f.db.prepare('UPDATE tasks SET service_pack_id=?,service_type_id=NULL WHERE id=?').run(pack.id,tasks[1].id));
 assert.equal(f.db.prepare("SELECT count(*) n FROM work_audit WHERE entity IN ('service','pack')").get().n,3);
 const servicePath='/sandbox/services/'+service.id+'/edit';
 const send=(path,v)=>f.request(path,new URLSearchParams(v).toString());
 assert.equal((await send(servicePath,{...service,version:'1',hourly_rate:'150.25'})).status,303);
 assert.equal((await send(servicePath,{...service,version:'1'})).status,409);
 const other=crypto.randomUUID();
 f.db.prepare("INSERT INTO clients(id,client_type,display_name,first_name,status,preferred_contact_method,tags,created_at,updated_at,changed_by) VALUES(?,'person','Other fictional client','Other','active','email','[]','2026','2026','test')").run(other);
 const otherPack={...pack,id:crypto.randomUUID(),client_id:other};
 assert.equal((await send('/sandbox/packs/new',otherPack)).status,303);
 assert.equal((await send('/sandbox/allocations/'+tasks[1].id,{id:tasks[1].id,version:'3',service_type_id:service.id,service_pack_id:otherPack.id})).status,400);
 f.db.exec("CREATE TRIGGER fail_service_audit BEFORE INSERT ON work_audit BEGIN SELECT RAISE(ABORT,'audit failure'); END;");
 assert.equal((await send(servicePath,{...service,version:'2',hourly_rate:'200'})).status,503);
 assert.equal(f.db.prepare('SELECT hourly_rate_cents FROM service_types WHERE id=?').get(service.id).hourly_rate_cents,15025);
 for(const path of ['/sandbox/services/new','/sandbox/packs/new','/sandbox/allocations/'+tasks[0].id]){
 assert.equal((await f.request(path,'x=1',{Origin:'https://evil.example'})).status,403);
 assert.equal((await f.request(path,'x=1',{'Cf-Access-Jwt-Assertion':''})).status,401);
 }
 }finally{f.db.close()}});
