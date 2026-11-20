import test from 'node:test';
import assert from 'node:assert/strict';
import {editingFixture} from '../tests/helpers/editing-fixture.mjs';
import {fields} from './client-editor.mjs';
const root='/sandbox/clients',seed='11111111-1111-4111-8111-111111111111';
const input=()=>Object.fromEntries([...fields.map(k=>[k,'']),['id',crypto.randomUUID()],['version',''],['client_type','person'],['first_name','Test'],['display_name','<Test & Client>'],['status','active'],['preferred_contact_method','email'],['tags','alpha, beta'],['date_of_birth','1990-02-28']]);
const body=v=>new URLSearchParams(v).toString();
test('client create/edit rehearsal: validation, atomic audit, duplicates and stale edits',async()=>{
 const f=await editingFixture();try {
 let v=input();
 let r=await f.request(root+'/new',body({...v,first_name:''}));assert.equal(r.status,400);
 assert.equal(f.db.prepare('SELECT count(*) n FROM clients').get().n,1);
 r=await f.request(root+'/new',body(v));assert.equal(r.status,303);const path=new URL(r.headers.get('Location'),f.url).pathname;
 let record=f.db.prepare('SELECT * FROM clients WHERE id=?').get(v.id);
 assert.equal(record.date_of_birth,'1990-02-28');assert.equal(record.phone,null);assert.deepEqual(JSON.parse(record.tags),['alpha','beta']);
 assert.equal(record.version,1);assert.equal(record.changed_by,'https://test.cloudflareaccess.com|staff-1');
 assert.match(await (await f.request(path)).text(),/&lt;Test &amp; Client&gt;/);
 assert.equal((await f.request(root+'/new',body(v))).status,409);
 v={...v,version:'1',display_name:'Edited client'};
 const responses=await Promise.all([f.request(path,body(v)),f.request(path,body({...v,display_name:'Other session'}))]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[303,409]);
 const audit=f.db.prepare('SELECT * FROM client_audit WHERE client_id=? ORDER BY version').all(v.id);assert.deepEqual(audit.map(x=>x.action),['create','edit']);
 record=f.db.prepare('SELECT * FROM clients WHERE id=?').get(v.id);assert.equal(record.version,2);assert.equal(record.created_at,audit[0].changed_at);
 // A failed audit must roll back the client write.
 f.db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON client_audit BEGIN SELECT RAISE(ABORT,'test audit failure'); END;");
 assert.equal((await f.request(path,body({...v,version:'2',display_name:'Should roll back'}))).status,503);
 assert.equal(f.db.prepare('SELECT version FROM clients WHERE id=?').get(v.id).version,2);
 }finally{f.db.close()}
});
test('writes require authorized identity, exact origin and valid method before SQL',async()=>{
 const f=await editingFixture();try{
 const v=input();
 for(const path of [root+'/new',root+'/'+seed+'/edit']){
 for(const headers of [{'Cf-Access-Jwt-Assertion':''},{'Cf-Access-Jwt-Assertion':'forged'},{Origin:'https://evil.example'},{Origin:'https://other.bloomwood.com.au'},{Origin:''},{'Sec-Fetch-Site':'cross-site'}]){
 const r=await f.request(path,body(v),headers);assert.ok([401,403].includes(r.status));
 }
 assert.equal((await f.request(path,body(v),{},'DELETE')).status,405);
 }
 assert.equal(f.calls(),0);
 assert.equal((await f.request(root+'/new',body({...v,date_of_birth:'2025-02-30'}))).status,400);
 assert.equal((await f.request(root+'/new',body({...v,status:'administrator'}))).status,400);
 assert.equal((await f.request(root+'/new',body(v)+'&display_name=duplicate')).status,400);
 assert.equal((await f.request(root+'/new','x'.repeat(17000))).status,400);
 assert.equal((await f.request(root+'/'+seed+'/edit',body({...v,version:'1'}))).status,400);
 assert.equal((await f.request(root+'/new',body({...v,client_type:'company',first_name:''}))).status,400);
 assert.equal(f.db.prepare('SELECT count(*) n FROM clients').get().n,1);
 }finally{f.db.close()}
});
