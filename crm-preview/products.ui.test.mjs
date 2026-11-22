import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {productScenario} from '../tests/helpers/product-fixture.mjs';
test('desktop/mobile products, SPack classification, discounts and removal',async()=>{
 const browser=await chromium.launch();try{for(const width of [1440,390]){
 const {f,path,j}=await productScenario(),page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const server=createServer(async(req,res)=>{try{
 const parts=[];for await(const part of req)parts.push(part);const headers=new Headers(req.headers);headers.set('Cf-Access-Jwt-Assertion',f.token);if(headers.get('origin')===origin)headers.set('origin',f.url);
 const r=await f.handle(new Request(f.url+req.url,{method:req.method,headers,body:parts.length?Buffer.concat(parts):undefined}),f.env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());
 }catch{res.writeHead(500);res.end('Fixture error')}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{
 await page.goto(origin+path);await page.getByRole('heading',{name:'Task products and discounts'}).waitFor();
 assert.match(await page.getByLabel('Product',{exact:true}).innerText(),/Service pack/);
 await page.getByLabel('Quantity',{exact:true}).fill('2');await page.getByLabel('Discount (%)',{exact:true}).fill('10');await page.getByRole('button',{name:'Add product',exact:true}).click();
 await page.getByRole('button',{name:'Remove SPack-5',exact:true}).waitFor();assert.match(await page.locator('main').innerText(),/900\.00/);
 if(process.env.CRM_QA_SCREENSHOT)await page.screenshot({path:process.env.CRM_QA_SCREENSHOT+'-products-'+width+'.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.goto(origin+'/sandbox/jobs/'+j.id+'/edit');assert.match(await page.locator('main').innerText(),/Total to be billed: \$900\.00 AUD/);
 await page.goto(origin+path);await page.getByRole('button',{name:'Remove SPack-5',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[name=version]')?.value==='3');assert.equal(await page.getByRole('button',{name:'Remove SPack-5'}).count(),0);assert.deepEqual(errors,[]);
 await page.goto(origin+'/sandbox/invoices/new?client_id='+j.client_id);
 await page.getByLabel('Product 1',{exact:true}).selectOption('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
 await page.getByLabel('Quantity 1',{exact:true}).fill('2');await page.getByLabel('Discount 1',{exact:true}).fill('10');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('button',{name:'Continue to Xero details'}).click();
 await page.getByRole('heading',{name:'Create Xero draft',exact:true}).waitFor();
 assert.match(await page.locator('main').innerText(),/Saved line amounts: \$900\.00 AUD/);

 }finally{await page.close();await new Promise(r=>server.close(r));f.db.close()}
 }}finally{await browser.close()}
});
