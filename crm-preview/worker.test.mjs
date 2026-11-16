import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {generateKeyPair, SignJWT} from 'jose';
import {createHandler} from './worker.mjs';

test('preview checks staff identity before reading D1 on every route', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./migrations/0001_sample_clients.sql', import.meta.url),'utf8'));
  const key = await generateKeyPair('RS256');
  const handle = createHandler(() => key.publicKey);
  let reads = 0;
  const env = {ACCESS_ISSUER:'https://sample-team.cloudflareaccess.com', ACCESS_AUD:'preview', STAFF_EMAIL:'staff@example.test',
    PREVIEW_DB:{prepare(sql){reads++; return {all:async()=>({results:db.prepare(sql).all()})};}}};
  const sign = (changes={}, signingKey=key.privateKey) => new SignJWT({email:env.STAFF_EMAIL,sub:'sample',iss:env.ACCESS_ISSUER,aud:'preview',exp:Math.floor(Date.now()/1000)+60,...changes}).setProtectedHeader({alg:'RS256'}).sign(signingKey);
  const req = (path, token, method='GET', host='crm-preview.bloomwood.com.au', bindings=env) => handle(new Request('https://'+host+path,{method,headers:token?{'Cf-Access-Jwt-Assertion':token}:{}}),bindings);
  db.exec("CREATE TABLE clients (id TEXT, display_name TEXT, status TEXT, email TEXT); INSERT INTO clients VALUES ('1','<Example>','active','hidden@example.test')");
  env.DIRECTORY_STAGE = env.PREVIEW_DB;
  const valid = await sign();
  for(const path of ['/','/api/clients','/directory']){
    for(const token of [null,'invalid',await sign({aud:'other'}),await sign({iss:'https://other.cloudflareaccess.com'}),await sign({exp:1}),await sign({},(await generateKeyPair('RS256')).privateKey)])
      assert.equal((await req(path,token)).status,401);
    assert.equal((await req(path,await sign({email:'other@example.test'}))).status,403);
    assert.equal((await req(path,valid,'GET','alternate.example')).status,404);
    assert.equal((await req(path,valid,'POST')).status,405);
    assert.equal((await req(path,valid,'GET','crm-preview.bloomwood.com.au',{})).status,503);
  }
  assert.equal(reads,0);
  const page=await req('/',valid);assert.equal(page.status,200);assert.match(await page.text(),/Sample records only/);
  const staged=await req('/directory',valid);assert.equal(staged.status,200);assert.equal(staged.headers.get('Cache-Control'),'private, no-store');
  const html=await staged.text();assert.match(html,/&lt;Example&gt;/);assert.doesNotMatch(html,/hidden@example|Sample records only/);
  const twoStaff = {...env, STAFF_EMAIL: 'first@example.test, STAFF@example.test'};
  for (const [email, status] of [['first@example.test',200],['staff@example.test',200],['other@example.test',403],['staff@example.test.invalid',403]]) {
    assert.equal((await req('/directory',await sign({email}),'GET','crm-preview.bloomwood.com.au',twoStaff)).status,status);
  }
  const api=await req('/api/clients',valid);assert.equal(api.headers.get('Cache-Control'),'private, no-store');assert.equal((await api.json()).length,3);db.close();
});
