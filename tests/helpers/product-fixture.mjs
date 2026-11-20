import assert from 'node:assert/strict';
import {xeroFixture} from './xero-fixture.mjs';
const live='dddddddd-dddd-4ddd-8ddd-dddddddddddd',item='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
export async function productScenario(){
 const t=await xeroFixture(),f=t.f,base=f.env.XERO_FETCH,requests=[];
 f.env.XERO_FETCH=async(url,options={})=>{
 requests.push([url,options.method||'GET']);
 if(url.endsWith('/connections'))return Response.json([{tenantId:live,tenantName:'Bloomwood live'}]);
 if(options.headers['Xero-tenant-id']===live){
 assert.equal(options.method||'GET','GET');
 if(url.endsWith('/Organisation'))return Response.json({Organisations:[{Name:'Bloomwood live',BaseCurrency:'AUD',IsDemoCompany:false}]});
 if(url.includes('/Items'))return Response.json({Items:[{ItemID:item,Code:'SPack-5',Name:'Five hour pack',IsSold:true,SalesDetails:{UnitPrice:500,AccountCode:'200',TaxType:'OUTPUT'}}]});
 }return base(url,options);
 };
 assert.equal((await t.send('/sandbox/items',{id:'sync',version:'',tenant_id:live})).status,303);
 const j={id:crypto.randomUUID(),version:'',client_id:'11111111-1111-4111-8111-111111111111',title:'Product job',details:'',status:'open'};
 await t.send('/sandbox/jobs/new',j);
 const task={id:crypto.randomUUID(),version:'',title:'Pack sale',details:'',status:'done',billable_minutes:'60',non_billable_minutes:'0'};
 await t.send('/sandbox/jobs/'+j.id+'/tasks/new',task);
 return {t,f,task,j,path:'/sandbox/tasks/'+task.id+'/items',requests};
}
