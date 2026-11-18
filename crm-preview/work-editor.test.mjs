import test from 'node:test';
import assert from 'node:assert/strict';
import {editingFixture} from '../tests/helpers/editing-fixture.mjs';
const body=v=>new URLSearchParams(v).toString();
test('jobs/tasks preserve links, calculate time, audit, reject stale edits and enforce closure',async()=>{
 const f=await editingFixture();try{
 const j={id:crypto.randomUUID(),version:'',client_id:'11111111-1111-4111-8111-111111111111',title:'Test job',details:'',status:'open'},jp=`/sandbox/jobs/${j.id}/edit`;
 assert.equal((await f.request('/sandbox/jobs/new',body(j))).status,303);
 assert.equal((await f.request('/sandbox/jobs/new',body(j))).status,409);
 const t={id:crypto.randomUUID(),version:'',title:'Test task',details:'',status:'open',billable_minutes:'45',non_billable_minutes:'15'},tp=`/sandbox/tasks/${t.id}/edit`,create=`/sandbox/jobs/${j.id}/tasks/new`;
 assert.equal((await f.request(create,body({...t,billable_minutes:'1.5'}))).status,400);
 assert.equal((await f.request(create,body(t))).status,303);
 let row=f.db.prepare('SELECT * FROM tasks WHERE id=?').get(t.id);assert.equal(row.client_id,j.client_id);assert.equal(row.time_taken_minutes,60);
 assert.match(await (await f.request(jp)).text(),/45 billable minutes/);
 assert.equal((await f.request(jp,body({...j,version:'1',status:'completed'}))).status,409);
 assert.equal((await f.request(tp,body({...t,version:'1',status:'done'}))).status,303);
 assert.equal((await f.request(tp,body({...t,version:'1'}))).status,409);
 assert.ok(f.db.prepare('SELECT completed_at FROM tasks WHERE id=?').get(t.id).completed_at);
 assert.equal((await f.request(jp,body({...j,version:'1',status:'completed'}))).status,303);
 assert.equal((await f.request(tp,body({...t,version:'2'}))).status,409);
 assert.equal((await f.request(jp,body({...j,version:'2',status:'open'}))).status,303);
 assert.equal((await f.request(tp,body({...t,version:'2',status:'cancelled'}))).status,303);
 assert.match(await (await f.request(jp)).text(),/0 billable minutes/);
 assert.equal(f.db.prepare('SELECT completed_at FROM tasks WHERE id=?').get(t.id).completed_at,null);
 assert.equal(f.db.prepare('SELECT count(*) n FROM work_audit').get().n,6);
 f.db.exec("CREATE TRIGGER fail_work_audit BEFORE INSERT ON work_audit BEGIN SELECT RAISE(ABORT,'audit failed'); END;");
 assert.equal((await f.request(tp,body({...t,version:'3'}))).status,503);
 assert.equal(f.db.prepare('SELECT version FROM tasks WHERE id=?').get(t.id).version,3);
 }finally{f.db.close()}
});
test('job and task writes reject unauthorized and cross-origin submissions before SQL',async()=>{
 const f=await editingFixture();try{
 for(const path of ['/sandbox/jobs/new','/sandbox/jobs/11111111-1111-4111-8111-111111111111/tasks/new','/sandbox/tasks/11111111-1111-4111-8111-111111111111/edit']){
 assert.equal((await f.request(path,'x=1',{Origin:'https://evil.example'})).status,403);
 assert.equal((await f.request(path,'x=1',{'Cf-Access-Jwt-Assertion':''})).status,401);
 assert.equal((await f.request(path,'x=1',{},'DELETE')).status,405);
 }assert.equal(f.calls(),0);
 }finally{f.db.close()}
});

test('job billing shares pack capacity across jobs and distinguishes unpriced time',async()=>{
 const {jobBilling}=await import('./work-editor.mjs');
 const task=(id,job_id,billable_minutes,rate,pack='p',status='done')=>({id,job_id,billable_minutes,hourly_rate_cents:rate,service_pack_id:pack,status,created_at:id});
 const tasks=[task('1','other',45,12000),task('2','job',45,12000),task('3','job',30,6000,null),task('4','job',500,12000,'p','cancelled'),task('5','job',10,null,null),task('6','job',5,0,null)];
 assert.deepEqual(jobBilling('job',tasks,[{id:'p',purchased_minutes:60}]),{covered:15,uncovered:75,cents:9000,unpriced:10});
 assert.deepEqual(jobBilling('job',[],[]),{covered:0,uncovered:0,cents:0,unpriced:0});
 assert.equal(jobBilling('job',[task('1','job',1,12550,null),task('2','job',1,12550,null)],[]).cents,418);
});
