import assert from 'node:assert/strict';
import {editingFixture} from './editing-fixture.mjs';
import {verifyServices} from './service-scenario.mjs';
import {seal} from '../../crm-preview/xero-connection.mjs';
const tenant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',contact='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',remoteId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export async function xeroFixture(){
 const f=await editingFixture(),{pack,tasks}=await verifyServices(f),t=tasks[1];
 const send=(p,v)=>f.request(p,new URLSearchParams(v).toString());
 await send('/sandbox/tasks/'+t.id+'/edit',{...t,version:'3',status:'done'});
 const id=crypto.randomUUID();await send('/sandbox/invoices/new',{id,version:'',client_id:pack.client_id,task_ids:t.id});
 Object.assign(f.env,{XERO_CLIENT_ID:'test-client',XERO_CLIENT_SECRET:'test-secret',XERO_TOKEN_KEY:btoa('k'.repeat(32))});
 await f.db.prepare('INSERT INTO connection(id,encrypted_tokens,expires_at,tenant_id,tenant_name) VALUES(1,?,?,?,?)').run(await seal(f.env,{access_token:'test-access',refresh_token:'test-refresh'}),Date.now()+3600000,tenant,'Demo Company AU');
 let writes=0,lastBody,mode='success',demo=true;
 f.env.XERO_FETCH=async(url,opts={})=>{
 assert.equal(opts.headers.Authorization,'Bearer test-access');
 if(url.endsWith('/Organisation'))return Response.json({Organisations:[{IsDemoCompany:demo,BaseCurrency:'AUD'}]});
 if(url.includes('/Contacts'))return Response.json({Contacts:[{ContactID:contact,Name:'Demo customer'}]});
 if(url.endsWith('/Accounts'))return Response.json({Accounts:[{Code:'200',Name:'Sales',Status:'ACTIVE',Type:'REVENUE'}]});
 if(url.endsWith('/TaxRates'))return Response.json({TaxRates:[{TaxType:'OUTPUT',Name:'GST on income',Status:'ACTIVE',CanApplyToRevenue:true}]});
 if(opts.method==='PUT'){
 writes++;lastBody=JSON.parse(opts.body);assert.equal(opts.headers['Idempotency-Key'],'bloomwood-'+id);
 if(mode==='uncertain')throw Error('Network response lost');
 }
 if(url.includes('/Invoices'))return Response.json({Invoices:[{InvoiceID:remoteId,InvoiceNumber:'INV-123',Status:'DRAFT',Total:103.54,Type:'ACCREC',CurrencyCode:'AUD',Reference:'Bloomwood CRM '+id,Contact:{ContactID:contact}}]});
 throw Error('Unexpected request');
 };
 return {f,send,id,path:'/sandbox/invoices/'+id+'/xero',values:{id,version:'1',action:'create',contact_id:contact,account_code:'200',tax_type:'OUTPUT',amount_type:'Exclusive',date:'2026-11-19',due_date:'2026-12-03'},writes:()=>writes,body:()=>lastBody,setMode:v=>mode=v,setDemo:v=>demo=v};
}
