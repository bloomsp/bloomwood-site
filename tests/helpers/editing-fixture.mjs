import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {generateKeyPair, SignJWT} from 'jose';
import {createHandler} from '../../crm-preview/worker.mjs';

export async function editingFixture() {
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../../crm-preview/editing-migrations/0001_clients.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../../crm-preview/editing-migrations/0002_jobs_tasks.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../../crm-preview/editing-migrations/0003_services.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../../crm-preview/editing-migrations/0004_invoices.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../../crm-preview/editing-migrations/0005_deliveries.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../../crm-preview/editing-migrations/0006_public_links.sql',import.meta.url),'utf8'));
 const objects=new Map();
 const key=await generateKeyPair('RS256'),issuer='https://test.cloudflareaccess.com';
 const token=await new SignJWT({email:'staff@example.test'}).setProtectedHeader({alg:'RS256'}).setSubject('staff-1').setIssuer(issuer).setAudience('test').setExpirationTime('5m').sign(key.privateKey);
 let calls=0;
 const env={EDITING_FILES:{async put(key,bytes){objects.set(key,new Uint8Array(bytes));},async get(key){return objects.has(key)?{body:objects.get(key)}:null;}},ACCESS_ISSUER:issuer,ACCESS_AUD:'test',STAFF_EMAIL:'staff@example.test',EDITING_DB:{
  prepare(sql){calls++;let params=[];const s={bind(...p){params=p;return s},async first(){return db.prepare(sql).get(...params)},async all(){return {results:db.prepare(sql).all(...params)}},async run(){return {success:true,meta:db.prepare(sql).run(...params)}}};return s}
 }};
 const handle=createHandler(()=>key.publicKey);
 const url='https://crm-preview.bloomwood.com.au';
 const request=(path,body,headers={},method=body?'POST':'GET')=>handle(new Request(url+path,{method,headers:{'Cf-Access-Jwt-Assertion':token,...(body?{Origin:url,'Content-Type':'application/x-www-form-urlencoded'}:{}),...headers},body}),env);
 return {db,env,handle,request,url,token,calls:()=>calls};
}
