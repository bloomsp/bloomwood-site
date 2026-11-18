import {page,esc,uuid,readForm} from './client-editor.mjs';
import {xeroSession,xeroApi,requireDemo} from './xero-connection.mjs';
export function draftPayload(invoice,lines,v){
 return {Invoices:[{Type:'ACCREC',Status:'DRAFT',Contact:{ContactID:v.contact_id},Date:v.date,DueDate:v.due_date,CurrencyCode:'AUD',LineAmountTypes:v.amount_type,Reference:'Bloomwood CRM '+invoice.id,Url:'https://crm-preview.bloomwood.com.au/sandbox/invoices/'+invoice.id,LineItems:lines.map(l=>({Description:l.title+' — '+(l.billable_minutes-l.covered_minutes)+' uncovered minutes',Quantity:1,UnitAmount:l.amount_cents/100,AccountCode:v.account_code,TaxType:v.tax_type}))}]};
}
const select=(name,label,rows)=>`<label>${label}<select name="${name}" aria-label="${label}" required><option value="">Choose…</option>${rows.map(([id,text])=>`<option value="${esc(id)}">${esc(text)}</option>`).join('')}</select></label>`;
export async function xeroInvoice(request,env,actor,respond){
 const url=new URL(request.url),m=url.pathname.match(/^\/sandbox\/invoices\/([0-9a-f-]+)\/xero$/),id=m?.[1];if(!id||!uuid.test(id))return respond('Not found',404);
 if(!['GET','POST'].includes(request.method))return respond('Method not allowed',405);
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||['cross-site','same-site'].includes(request.headers.get('sec-fetch-site'))))return respond('Submit from the CRM.',403);
 const db=env.EDITING_DB;
 try{
 const invoice=await db.prepare('SELECT * FROM invoices WHERE id=?').bind(id).first();if(!invoice)return respond('Invoice not found',404);
 let exported=await db.prepare('SELECT * FROM xero_exports WHERE invoice_id=?').bind(id).first();
 const renderExport=e=>page('Xero invoice',`<p>${esc(invoice.client_name)}</p><p>Export: ${esc(e.state)}</p>${e.xero_invoice_id?`<p>Xero invoice number: <strong>${esc(e.xero_invoice_number)}</strong></p><p>Xero status: ${esc(e.xero_status)} · Total: $${Number(e.xero_total).toFixed(2)} AUD</p><a rel="noreferrer" href="https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${esc(e.xero_invoice_id)}">Open invoice in Xero</a>`:'<p>The result is not confirmed. Check Xero for the CRM reference. Refresh performs a lookup only and will not create another invoice.</p>'}<form method="post"><input type="hidden" name="id" value="${id}"><input type="hidden" name="version" value="${invoice.version}"><input type="hidden" name="action" value="refresh"><button>Refresh from Xero</button></form><p>Manage invoice status and sending in Xero. CRM task reservations remain in place until a separate correction/reconciliation workflow is implemented.</p><a href="/sandbox/invoices/${id}">Back to CRM invoice</a>`);
 if(exported&&request.method==='GET')return respond(renderExport(exported),200,'text/html');
 const session=await xeroSession(env);await requireDemo(env,session);
 if(exported){
 const v=await readForm(request,['action']);if(v.id!==id||v.action!=='refresh')return respond('Invalid form',400);
 if(exported.tenant_id!==session.tenant)return respond('Reconnect the original Demo Company before refreshing this invoice.',409);
 const reference=JSON.parse(exported.request_json).Invoices[0].Reference;
 const data=await xeroApi(env,session,exported.xero_invoice_id?'Invoices/'+exported.xero_invoice_id:'Invoices?where='+encodeURIComponent('Reference=="'+reference+'"'));
 const matches=data.Invoices||[];
 if(matches.length!==1)return respond(renderExport(exported),409,'text/html');
 const remote=matches[0],original=JSON.parse(exported.request_json).Invoices[0];
 if(!uuid.test(remote.InvoiceID||'')||remote.Type!=='ACCREC'||remote.CurrencyCode!=='AUD'||remote.Reference!==reference||remote.Contact?.ContactID!==original.Contact.ContactID)throw Error('Xero identity mismatch');
 await saveRemote(db,id,remote,actor);exported=await db.prepare('SELECT * FROM xero_exports WHERE invoice_id=?').bind(id).first();return respond(renderExport(exported),200,'text/html');
 }
 if(invoice.status!=='draft')return respond('Only a CRM draft can be exported.',409);
 const contacts=(await xeroApi(env,session,'Contacts?page=1&where='+encodeURIComponent('ContactStatus=="ACTIVE"'))).Contacts||[];
 const accounts=(await xeroApi(env,session,'Accounts')).Accounts?.filter(a=>a.Status==='ACTIVE'&&['REVENUE','SALES','OTHERINCOME'].includes(a.Type))||[];
 const taxes=(await xeroApi(env,session,'TaxRates')).TaxRates?.filter(t=>t.Status==='ACTIVE'&&t.CanApplyToRevenue===true)||[];
 const lines=(await db.prepare('SELECT * FROM invoice_lines WHERE invoice_id=? ORDER BY task_id').bind(id).all()).results;
 if(request.method==='GET')return respond(page('Create Xero draft',`<p>Australian Demo Company only. This creates a draft for review in Xero and does not send it.</p><p>CRM client: ${esc(invoice.client_name)}. Select the matching Xero contact explicitly (first page of active contacts).</p><p>Saved line amounts: $${(lines.reduce((s,l)=>s+l.amount_cents,0)/100).toFixed(2)} AUD. Choose whether these amounts include or exclude tax. Xero calculates tax.</p><form method="post"><input type="hidden" name="id" value="${id}"><input type="hidden" name="version" value="${invoice.version}"><input type="hidden" name="action" value="create">${select('contact_id','Xero contact',contacts.map(c=>[c.ContactID,c.Name]))}${select('account_code','Sales account',accounts.map(a=>[a.Code,a.Code+' — '+a.Name]))}${select('tax_type','Tax treatment',taxes.map(t=>[t.TaxType,t.Name]))}${select('amount_type','Line amounts',[['Exclusive','Tax exclusive'],['Inclusive','Tax inclusive']])}<label>Invoice date<input name="date" type="date" required></label><label>Due date<input name="due_date" type="date" required></label><button class="full">Create draft in Xero Demo Company</button></form>`),200,'text/html');
 const v=await readForm(request,['action','contact_id','account_code','tax_type','amount_type','date','due_date']);
 const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(v.id!==id||v.version!==String(invoice.version)||v.action!=='create'||!contacts.some(c=>c.ContactID===v.contact_id)||!accounts.some(a=>a.Code===v.account_code)||!taxes.some(t=>t.TaxType===v.tax_type)||!['Inclusive','Exclusive'].includes(v.amount_type)||!date(v.date)||!date(v.due_date)||v.due_date<v.date)return respond('Choose valid contact, account, tax treatment and dates. Reload if the invoice changed.',400);
 const payload=draftPayload(invoice,lines,v),now=new Date().toISOString();
 const claim=await db.prepare("INSERT INTO xero_exports(invoice_id,tenant_id,request_json,state,created_at,updated_at,changed_by) SELECT id,?,?,'submitting',?,?,? FROM invoices WHERE id=? AND status='draft' AND version=? ON CONFLICT(invoice_id) DO NOTHING RETURNING invoice_id").bind(session.tenant,JSON.stringify(payload),now,now,actor,id,Number(v.version)).all();
 if(!claim.results.length)return respond('Invoice changed or an export is already in progress. Reload to check it.',409);
 try{
 const data=await xeroApi(env,session,'Invoices',{method:'PUT',headers:{'Idempotency-Key':'bloomwood-'+id},body:JSON.stringify(payload)}),remote=data.Invoices?.[0];
 if(data.Invoices?.length!==1||remote.HasErrors||!uuid.test(remote.InvoiceID||'')||!remote.InvoiceNumber||remote.Status!=='DRAFT'||remote.Reference!==payload.Invoices[0].Reference||remote.Contact?.ContactID!==v.contact_id)throw Error('Xero did not confirm a draft');
 await saveRemote(db,id,remote,actor);
 }catch{await db.prepare("UPDATE xero_exports SET state='uncertain',updated_at=?,changed_by=? WHERE invoice_id=? AND state!='linked'").bind(new Date().toISOString(),actor,id).run();}
 return respond('',303,'text/plain',{Location:url.pathname});
 }catch{return respond(page('Xero unavailable','<p>Check the Xero connection and Demo Company access. Any export already started remains reserved; use Refresh from Xero to reconcile it before further action.</p><a href="/sandbox/xero">Xero connection</a>'),503,'text/html')}
}
async function saveRemote(db,id,remote,actor){
 if(!Number.isFinite(remote.Total)||typeof remote.Status!=='string'||typeof remote.InvoiceNumber!=='string')throw Error('Invalid invoice response');
 await db.prepare("UPDATE xero_exports SET state='linked',xero_invoice_id=?,xero_invoice_number=?,xero_status=?,xero_total=?,updated_at=?,changed_by=? WHERE invoice_id=?").bind(remote.InvoiceID,remote.InvoiceNumber,remote.Status,remote.Total,new Date().toISOString(),actor,id).run();
}
