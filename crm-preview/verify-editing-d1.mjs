import {verifyServices} from '../tests/helpers/service-scenario.mjs';
// Explicit opt-in: creates a fictional client in the dedicated remote editing sandbox.
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {editingFixture} from '../tests/helpers/editing-fixture.mjs';
import {fields} from './client-editor.mjs';
if(process.argv[2]!=='--remote-sandbox')throw Error('Use --remote-sandbox to test the dedicated fictional-data database.');
const {token}=JSON.parse(execFileSync('npx',['wrangler','auth','token','--json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
const f=await editingFixture();
const query=async(sql,params=[])=>{
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/7a27a16e576dedbec33e52a895bc00db/d1/database/1147ffdc-6285-404f-8a0a-b17eaa925656/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sql,params})});
 const j=await r.json();if(!j.success||!j.result?.[0]?.success)throw Error('Remote D1 query failed');return j.result[0];
};
f.env.EDITING_DB={prepare(sql){let params=[];const s={bind(...p){params=p;return s},async all(){return query(sql,params)},async first(){return (await query(sql,params)).results[0]}};return s}};
try{
 const v=Object.fromEntries([...fields.map(k=>[k,'']),['id',crypto.randomUUID()],['version',''],['client_type','person'],['first_name','Fictional'],['display_name','Fictional D1 verification client'],['status','active'],['preferred_contact_method','email']]);
 const send=(path,data)=>f.request(path,new URLSearchParams(data).toString());
 assert.equal((await send('/sandbox/clients/new',v)).status,303);
 const path='/sandbox/clients/'+v.id+'/edit';
 assert.equal((await send(path,{...v,version:'1',status:'inactive'})).status,303);
 assert.equal((await send(path,{...v,version:'1',status:'active'})).status,409);
 const r=await query('SELECT version,status FROM clients WHERE id=?',[v.id]);assert.equal(r.results[0].version,2);assert.equal(r.results[0].status,'inactive');
 assert.equal((await query('SELECT count(*) n FROM client_audit WHERE client_id=?',[v.id])).results[0].n,2);
 const job={id:crypto.randomUUID(),version:'',client_id:v.id,title:'Fictional D1 verification job',details:'',status:'open'};
 assert.equal((await send('/sandbox/jobs/new',job)).status,303);
 const jobPath='/sandbox/jobs/'+job.id+'/edit';
 const task={id:crypto.randomUUID(),version:'',title:'Fictional D1 verification task',details:'',status:'open',billable_minutes:'45',non_billable_minutes:'15'};
 assert.equal((await send('/sandbox/jobs/'+job.id+'/tasks/new',task)).status,303);
 assert.equal((await send(jobPath,{...job,version:'1',status:'completed'})).status,409);
 const taskPath='/sandbox/tasks/'+task.id+'/edit';
 assert.equal((await send(taskPath,{...task,version:'1',status:'done'})).status,303);
 assert.equal((await send(taskPath,{...task,version:'1'})).status,409);
 assert.equal((await send(jobPath,{...job,version:'1',status:'completed'})).status,303);
 assert.equal((await send(taskPath,{...task,version:'2'})).status,409);
 const saved=(await query('SELECT * FROM tasks WHERE id=?',[task.id])).results[0];
 assert.equal(saved.client_id,v.id);assert.equal(saved.time_taken_minutes,60);assert.ok(saved.completed_at);
 assert.equal((await query('SELECT count(*) n FROM work_audit WHERE record_id IN (?,?)',[job.id,task.id])).results[0].n,4);
 await verifyServices(f);
 console.log('PASS actual D1: services, rates, pack allocation, cancellation and reassignment balances;  clients, linked jobs/tasks, generated totals, completion, closure, stale-write rejection and atomic audits.');
}finally{f.db.close()}
