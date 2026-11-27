import test from 'node:test';
import assert from 'node:assert/strict';
import {editingFixture} from '../tests/helpers/editing-fixture.mjs';
import {publicDownload,publicOrigin} from './public-download.mjs';
async function setup(){
 const f=await editingFixture(),job={id:crypto.randomUUID(),version:'',client_id:'11111111-1111-4111-8111-111111111111',title:'Public file test',details:'',status:'open'};
 await f.request('/sandbox/jobs/new',new URLSearchParams(job).toString());
 const id=crypto.randomUUID(),form=new FormData();form.set('id',id);form.set('job_id',job.id);form.set('file',new Blob(['fictional bytes']),'test.txt');
 const r=await f.handle(new Request(f.url+'/sandbox/deliveries/new',{method:'POST',headers:{Origin:f.url,'Cf-Access-Jwt-Assertion':f.token},body:form}),f.env);assert.equal(r.status,303);
 const path='/sandbox/deliveries/'+id;
 const share=async(version,action='share')=>f.request(path,new URLSearchParams({id,version:String(version),action}).toString());
 const link=html=>html.match(/https:\/\/files-preview\.bloomwood\.com\.au\/d\/[a-f0-9]{64}/)[0];
 return {f,id,path,share,link};
}
test('public links rotate, expire, enforce quota atomically and expose no CRM',async()=>{
 const {f,id,share,link}=await setup();try{
 const first=link(await (await share(2)).text());
 const get=url=>publicDownload(new Request(url),f.env);
 assert.equal((await get(first)).status,200);
 assert.equal((await get(publicOrigin+'/sandbox/clients')).status,404);
 assert.equal((await get(first.replace('/d/','/bad/'))).status,404);
 const second=link(await (await share(3)).text());assert.equal((await get(first)).status,404);
 f.db.prepare('UPDATE deliveries SET public_downloads=9 WHERE id=?').run(id);
 const results=await Promise.all([get(second+'/download'),get(second+'/download')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,404]);
 assert.equal(await results.find(r=>r.status===200).text(),'fictional bytes');
 assert.equal(f.db.prepare('SELECT public_downloads FROM deliveries WHERE id=?').get(id).public_downloads,10);
 assert.equal((await get(second)).status,404);
 const row=f.db.prepare('SELECT * FROM deliveries WHERE id=?').get(id);assert.ok(!JSON.stringify(row).includes(second.split('/').pop()));
 f.db.prepare("UPDATE deliveries SET public_downloads=0,expires_at='2000-01-01' WHERE id=?").run(id);assert.equal((await get(second)).status,404);
 }finally{f.db.close()}
});
test('revocation during object fetch blocks download and missing object does not consume quota',async()=>{
 const {f,id,share,link}=await setup();try{
 const url=link(await (await share(2)).text());f.env.EDITING_FILES.get=async()=>null;
 assert.equal((await publicDownload(new Request(url+'/download'),f.env)).status,404);
 assert.equal(f.db.prepare('SELECT public_downloads FROM deliveries WHERE id=?').get(id).public_downloads,0);
 f.env.EDITING_FILES.get=async()=>{f.db.prepare("UPDATE deliveries SET status='revoked' WHERE id=?").run(id);return {body:'fictional'}};
 assert.equal((await publicDownload(new Request(url+'/download'),f.env)).status,404);
 }finally{f.db.close()}
});
test('test email is opt-in, fixed-recipient and resistant to replay',async()=>{
 const {f,share}=await setup();try{
 assert.equal((await share(2,'email')).status,503);
 const sent=[];f.env.DELIVERY_EMAIL={send:async message=>sent.push(message)};f.env.DELIVERY_FROM='files@example.test';f.env.DELIVERY_TEST_TO='staff@example.test';
 assert.equal((await share(2,'email')).status,200);assert.equal(sent.length,1);assert.equal(sent[0].to,'staff@example.test');
 assert.equal((await share(2,'email')).status,409);assert.equal(sent.length,1);
 }finally{f.db.close()}
});
