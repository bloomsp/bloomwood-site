import {xeroFixture} from '../tests/helpers/xero-fixture.mjs';
const remoteId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
import test from 'node:test';
import assert from 'node:assert/strict';
import {editingFixture} from '../tests/helpers/editing-fixture.mjs';
import {verifyServices} from '../tests/helpers/service-scenario.mjs';
import {seal,callback} from './xero-connection.mjs';
import {tokenHash} from './public-download.mjs';
test('Xero draft saves invoice ID/number, freezes export and reconciles without duplicate creation',async()=>{
 const t=await xeroFixture();try{
 assert.equal((await t.send(t.path,t.values)).status,303);assert.equal(t.writes(),1);
 assert.equal(t.body().Invoices[0].Status,'DRAFT');assert.equal(t.body().Invoices[0].LineItems[0].UnitAmount,94.13);
 const saved=t.f.db.prepare('SELECT * FROM xero_exports').get();assert.equal(saved.xero_invoice_number,'INV-123');assert.equal(saved.xero_invoice_id,remoteId);
 assert.equal((await t.send(t.path,t.values)).status,400);assert.equal(t.writes(),1);
 assert.equal((await t.send('/sandbox/invoices/'+t.id,{id:t.id,version:'1',status:'cancelled'})).status,409);
 assert.match(await (await t.f.request('/sandbox/invoices/'+t.id)).text(),/INV-123/);
 }finally{t.f.db.close()}
});
test('uncertain export reconciles using GET only and live organisations are rejected',async()=>{
 const t=await xeroFixture();try{
 t.setDemo(false);assert.equal((await t.send(t.path,t.values)).status,503);assert.equal(t.writes(),0);
 t.setDemo(true);t.setMode('uncertain');assert.equal((await t.send(t.path,t.values)).status,303);
 assert.equal(t.f.db.prepare('SELECT state FROM xero_exports').get().state,'uncertain');
 assert.equal((await t.send(t.path,{id:t.id,version:'1',action:'refresh'})).status,200);assert.equal(t.writes(),1);
 assert.equal(t.f.db.prepare('SELECT state FROM xero_exports').get().state,'linked');
 }finally{t.f.db.close()}
});
test('Xero routes enforce origin and OAuth state is staff-bound, single use and expiring',async()=>{
 const t=await xeroFixture();try{
 assert.equal((await t.f.request('/sandbox/xero/connect','id=connect&version=',{Origin:'https://evil.example'})).status,403);
 assert.equal((await t.f.request(t.path,new URLSearchParams(t.values).toString(),{'Cf-Access-Jwt-Assertion':''})).status,401);
 const raw='fake-state';t.f.db.prepare('INSERT INTO oauth_states(hash,actor,expires_at) VALUES(?,?,?)').run(await tokenHash(raw),'another-actor',Date.now()+10000);
 assert.equal((await t.f.request('/sandbox/xero/callback?state='+raw+'&code=test')).status,403);
 assert.equal(t.f.db.prepare('SELECT count(*) n FROM oauth_states').get().n,1);
 const start=await t.send('/sandbox/xero/connect',{id:'connect',version:''});assert.equal(start.status,303);const url=new URL(start.headers.get('location'));assert.equal(url.searchParams.get('redirect_uri'),callback);
 assert.ok(!t.f.db.prepare('SELECT encrypted_tokens FROM connection').get().encrypted_tokens.includes('test-refresh'));
 }finally{t.f.db.close()}
});
test('OAuth callback consumes state once, encrypts tokens and refreshes expired access',async()=>{
 const t=await xeroFixture();try{
 const start=await t.send('/sandbox/xero/connect',{id:'connect',version:''}),state=new URL(start.headers.get('location')).searchParams.get('state');
 let refreshes=0;
 t.f.env.XERO_FETCH=async(url,opts={})=>{
 if(url.endsWith('/connect/token')){if(String(opts.body).includes('refresh_token'))refreshes++;return Response.json({access_token:'new-access',refresh_token:'new-refresh',expires_in:1800})}
 if(url.endsWith('/connections'))return Response.json([{tenantId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}]);
 if(url.endsWith('/Organisation'))return Response.json({Organisations:[{IsDemoCompany:true,BaseCurrency:'AUD',Name:'Demo Company AU'}]});
 throw Error('Unexpected request');
 };
 const path='/sandbox/xero/callback?state='+state+'&code=test';assert.equal((await t.f.request(path)).status,303);assert.equal((await t.f.request(path)).status,403);
 assert.ok(!t.f.db.prepare('SELECT encrypted_tokens FROM connection').get().encrypted_tokens.includes('new-refresh'));
 t.f.db.prepare('UPDATE connection SET expires_at=0').run();
 const {xeroSession}=await import('./xero-connection.mjs');assert.equal((await xeroSession(t.f.env)).token,'new-access');assert.equal(refreshes,1);
 }finally{t.f.db.close()}
});
