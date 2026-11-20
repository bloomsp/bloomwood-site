import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {xeroFixture} from '../tests/helpers/xero-fixture.mjs';
test('desktop and mobile Xero draft form and stored invoice number',async()=>{
 const browser=await chromium.launch();try{for(const width of [1440,390]){
 const t=await xeroFixture(),f=t.f,page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const server=createServer(async(req,res)=>{try{
 const parts=[];for await(const part of req)parts.push(part);
 const headers=new Headers(req.headers);headers.set('Cf-Access-Jwt-Assertion',f.token);if(headers.get('origin')===origin)headers.set('origin',f.url);
 const r=await f.handle(new Request(f.url+req.url,{method:req.method,headers,body:parts.length?Buffer.concat(parts):undefined}),f.env);
 res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());
 }catch{res.writeHead(500);res.end('Test fixture failed')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 try{
 await page.route('https://login.xero.com/identity/connect/authorize**',route=>route.fulfill({status:200,contentType:'text/html',body:'<h1>Xero sign-in test destination</h1>'}));
 await page.goto(origin+'/sandbox/xero');
 await page.getByRole('button',{name:'Connect or update Xero access'}).click();
 await page.waitForURL(url=>url.origin==='https://login.xero.com',{timeout:5000,waitUntil:'commit'});
 assert.equal(new URL(page.url()).origin,'https://login.xero.com');
 await page.goto(origin+t.path);await page.getByRole('heading',{name:'Create Xero draft',exact:true}).waitFor();
 await page.getByLabel('Xero contact',{exact:true}).selectOption({label:'Demo customer'});
 await page.getByLabel('Sales account',{exact:true}).selectOption('200');
 await page.getByLabel('Tax treatment',{exact:true}).selectOption('OUTPUT');
 await page.getByLabel('Line amounts',{exact:true}).selectOption('Exclusive');
 await page.getByLabel('Invoice date',{exact:true}).fill('2026-11-19');await page.getByLabel('Due date',{exact:true}).fill('2026-12-03');
 await page.getByRole('button',{name:'Create draft in Xero Demo Company'}).click();
 await page.getByRole('heading',{name:'Xero invoice',exact:true}).waitFor();assert.match(await page.locator('main').innerText(),/INV-123/);
 assert.equal(t.writes(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('button',{name:'Refresh from Xero'}).click();await page.getByRole('heading',{name:'Xero invoice',exact:true}).waitFor();assert.equal(t.writes(),1);
 if(process.env.CRM_QA_SCREENSHOT)await page.screenshot({path:process.env.CRM_QA_SCREENSHOT+'-xero-'+width+'.png',fullPage:true});assert.deepEqual(errors,[]);
 }finally{await page.close();await new Promise(resolve=>server.close(resolve));f.db.close()}
 }}finally{await browser.close()}
});
