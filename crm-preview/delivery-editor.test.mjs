import test from 'node:test';
import assert from 'node:assert/strict';
import {editingFixture} from '../tests/helpers/editing-fixture.mjs';
test('private file upload, download, duplicate prevention, revocation and expiry',async()=>{
 const f=await editingFixture();try{
 const j={id:crypto.randomUUID(),version:'',client_id:'11111111-1111-4111-8111-111111111111',title:'Fictional delivery',details:'',status:'open'};
 assert.equal((await f.request('/sandbox/jobs/new',new URLSearchParams(j).toString())).status,303);
 const id=crypto.randomUUID(),upload=()=>{const form=new FormData();form.set('id',id);form.set('job_id',j.id);form.set('file',new Blob(['Fictional file content']),'example.txt');return form};
 const send=(headers={})=>f.handle(new Request(f.url+'/sandbox/deliveries/new',{method:'POST',headers:{Origin:f.url,'Cf-Access-Jwt-Assertion':f.token,...headers},body:upload()}),f.env);
 assert.equal((await send({Origin:'https://evil.example'})).status,403);
 assert.equal((await send({'Cf-Access-Jwt-Assertion':''})).status,401);
 assert.equal((await send()).status,303);assert.equal((await send()).status,409);
 const path='/sandbox/deliveries/'+id;
 const download=await f.request(path+'/download');assert.equal(download.status,200);assert.equal(await download.text(),'Fictional file content');assert.match(download.headers.get('content-disposition'),/attachment/);
 assert.equal(f.db.prepare('SELECT count(*) n FROM delivery_downloads').get().n,1);
 assert.match(await (await f.request(path)).text(),/Not sent/);
 f.db.prepare("UPDATE deliveries SET expires_at='2000-01-01' WHERE id=?").run(id);
 assert.equal((await f.request(path+'/download')).status,410);
 f.db.prepare("UPDATE deliveries SET expires_at='2099-01-01' WHERE id=?").run(id);
 const form=new URLSearchParams({id,version:'2',action:'revoke'}).toString();
 assert.equal((await f.request(path,form)).status,303);assert.equal((await f.request(path,form)).status,409);
 assert.equal((await f.request(path+'/download')).status,410);
 assert.equal(f.db.prepare('SELECT count(*) n FROM delivery_downloads').get().n,1);
 }finally{f.db.close()}
});
test('upload failure stays unavailable and missing object consumes no download audit',async()=>{
 const f=await editingFixture();try{
 const j={id:crypto.randomUUID(),version:'',client_id:'11111111-1111-4111-8111-111111111111',title:'Fictional',details:'',status:'open'};
 await f.request('/sandbox/jobs/new',new URLSearchParams(j).toString());
 const id=crypto.randomUUID(),form=new FormData();form.set('id',id);form.set('job_id',j.id);form.set('file',new Blob(['test']),'test.txt');
 f.env.EDITING_FILES.put=async()=>{throw Error('storage unavailable')};
 const r=await f.handle(new Request(f.url+'/sandbox/deliveries/new',{method:'POST',headers:{Origin:f.url,'Cf-Access-Jwt-Assertion':f.token},body:form}),f.env);
 assert.equal(r.status,503);assert.equal((await f.request('/sandbox/deliveries/'+id+'/download')).status,410);
 f.db.prepare("UPDATE deliveries SET status='ready' WHERE id=?").run(id);
 assert.equal((await f.request('/sandbox/deliveries/'+id+'/download')).status,404);
 assert.equal(f.db.prepare('SELECT count(*) n FROM delivery_downloads').get().n,0);
 }finally{f.db.close()}
});
