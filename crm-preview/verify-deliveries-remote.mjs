// Opt-in rehearsal against only the dedicated fictional-data D1 and R2 resources.
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {editingFixture} from '../tests/helpers/editing-fixture.mjs';
if(process.argv[2]!=='--remote-sandbox')throw Error('Use --remote-sandbox');
const {token}=JSON.parse(execFileSync('npx',['wrangler','auth','token','--json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
const f=await editingFixture();
const query=async(sql,params=[])=>{
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/7a27a16e576dedbec33e52a895bc00db/d1/database/1147ffdc-6285-404f-8a0a-b17eaa925656/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sql,params})});
 const j=await r.json();if(!j.success||!j.result?.[0]?.success)throw Error('Remote D1 query failed');return j.result[0];
};
f.env.EDITING_DB={prepare(sql){let params=[];const s={bind(...p){params=p;return s},async all(){return query(sql,params)},async first(){return (await query(sql,params)).results[0]},async run(){return query(sql,params)}};return s}};
f.env.EDITING_FILES={async put(key,bytes){execFileSync('npx',['wrangler','r2','object','put','bloomwood-crm-editing-files/'+key,'--pipe','--remote','--content-type','application/octet-stream'],{input:Buffer.from(bytes),stdio:['pipe','ignore','pipe']});},async get(key){return {body:execFileSync('npx',['wrangler','r2','object','get','bloomwood-crm-editing-files/'+key,'--pipe','--remote'],{stdio:['ignore','pipe','pipe']})}}};
try{
 const job={id:crypto.randomUUID(),version:'',client_id:'11111111-1111-4111-8111-111111111111',title:'Fictional remote file check',details:'',status:'open'};
 assert.equal((await f.request('/sandbox/jobs/new',new URLSearchParams(job).toString())).status,303);
 const id=crypto.randomUUID(),form=new FormData();form.set('id',id);form.set('job_id',job.id);form.set('file',new Blob(['Fictional R2 verification bytes']),'fictional-r2-check.txt');
 const uploaded=await f.handle(new Request(f.url+'/sandbox/deliveries/new',{method:'POST',headers:{Origin:f.url,'Cf-Access-Jwt-Assertion':f.token},body:form}),f.env);
 assert.equal(uploaded.status,303);
 const path='/sandbox/deliveries/'+id;
 const downloaded=await f.request(path+'/download');assert.equal(downloaded.status,200);assert.equal(await downloaded.text(),'Fictional R2 verification bytes');
 const issued=await f.request(path,new URLSearchParams({id,version:'2',action:'share'}).toString());assert.equal(issued.status,200);
 const link=(await issued.text()).match(/https:\/\/files-preview\.bloomwood\.com\.au\/d\/[a-f0-9]{64}/)[0];
 const landing=await fetch(link,{redirect:'manual'});assert.equal(landing.status,200);assert.match(await landing.text(),/Bloomwood test file/);
 const publicFile=await fetch(link+'/download',{redirect:'manual'});assert.equal(publicFile.status,200);assert.equal(await publicFile.text(),'Fictional R2 verification bytes');
 const row=(await query('SELECT version FROM deliveries WHERE id=?',[id])).results[0];
 assert.equal((await f.request(path,new URLSearchParams({id,version:String(row.version),action:'revoke'}).toString())).status,303);
 assert.equal((await fetch(link,{redirect:'manual'})).status,404);
 assert.equal((await f.request(path+'/download')).status,410);
 assert.equal((await query('SELECT count(*) n FROM delivery_downloads WHERE delivery_id=?',[id])).results[0].n,1);
 console.log('PASS real D1/R2 and deployed public Worker: anonymous token landing/download, revoked link denial; upload, exact-byte download, audit and revocation. Fictional file retained privately.');
}finally{f.db.close()}
