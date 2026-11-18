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
 console.log('PASS actual D1: creation, editing, stale-write rejection and two atomic audit entries.');
}finally{f.db.close()}
