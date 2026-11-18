import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {editingFixture} from '../tests/helpers/editing-fixture.mjs';

test('desktop and mobile create and edit fictional clients through rendered forms',async()=>{
 const browser=await chromium.launch();
 try{for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 const f=await editingFixture(),page=await browser.newPage({viewport});
 page.setDefaultTimeout(5000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const server=createServer(async(req,res)=>{
  try {
   const parts=[];for await(const part of req)parts.push(part);
   const headers=new Headers(req.headers);headers.set('Cf-Access-Jwt-Assertion',f.token);
   if(headers.get('origin')===localOrigin)headers.set('origin',f.url);
   const response=await f.handle(new Request(f.url+req.url,{method:req.method,headers,body:parts.length?Buffer.concat(parts):undefined}),f.env);
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
  } catch {res.writeHead(500);res.end('Test fixture failed');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const localOrigin='http://127.0.0.1:'+server.address().port;
 try{
 await page.goto(localOrigin+'/sandbox/clients');assert.match(await page.title(),/Test clients/);
 await page.getByRole('link',{name:'Create test client'}).click();
 await page.getByLabel('Display name').fill('Fictional mobile test');
 await page.getByLabel('First name',{exact:true}).fill('Fictional');
 await page.getByLabel('Email',{exact:true}).fill('example@example.test');
 await page.getByRole('button',{name:'Save test client'}).click();
 await page.getByRole('heading',{name:'Edit test client'}).waitFor();
 assert.equal(await page.getByLabel('Display name').inputValue(),'Fictional mobile test');
 await page.getByLabel('Status',{exact:true}).selectOption('inactive');
 await page.getByRole('button',{name:'Save test client'}).click();
 await page.waitForFunction(()=>document.querySelector('[name=version]')?.value==='2');
 assert.equal(await page.getByLabel('Status',{exact:true}).inputValue(),'inactive');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 if(process.env.CRM_QA_SCREENSHOT)await page.screenshot({path:process.env.CRM_QA_SCREENSHOT+'-'+viewport.width+'.png',fullPage:true});
 assert.deepEqual(errors,[]);
 }finally{await page.close();await new Promise(resolve=>server.close(resolve));f.db.close()}
 }}finally{await browser.close()}
});
