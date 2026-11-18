import {page,esc,uuid,readForm} from './client-editor.mjs';
const root='/sandbox/invoices',money=c=>'$'+(c/100).toFixed(2)+' AUD';
export async function invoiceEditor(request,env,actor,respond){
 const url=new URL(request.url),path=url.pathname,list=path===root,isNew=path===root+'/new',match=path.match(/^\/sandbox\/invoices\/([0-9a-f-]+)$/),id=match?.[1];
 if(!list&&!isNew&&!(id&&uuid.test(id)))return respond('Not found',404);
 if(!['GET','POST'].includes(request.method)||list&&request.method==='POST')return respond('Method not allowed',405,'text/plain',{Allow:'GET'});
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||['cross-site','same-site'].includes(request.headers.get('sec-fetch-site'))))return respond('Reload and submit from the CRM.',403);
 const db=env.EDITING_DB;if(!db)return respond('Sandbox unavailable',503);
 try{
 if(list){const rows=(await db.prepare('SELECT i.*,coalesce(sum(l.amount_cents),0) total FROM invoices i LEFT JOIN invoice_lines l ON l.invoice_id=i.id GROUP BY i.id ORDER BY i.created_at DESC,i.id').all()).results;return respond(page('Test invoices',`<a href="${root}/new">Create draft invoice</a><ul>${rows.map(r=>`<li><a href="${root}/${r.id}">${esc(r.client_name)} · ${esc(r.id)}</a><span>${esc(r.status)} · ${money(r.total)}</span></li>`).join('')}</ul>`),200,'text/html')}
 if(isNew){
 if(request.method==='GET'){
 const clients=(await db.prepare('SELECT id,display_name FROM clients ORDER BY display_name,id').all()).results,client=url.searchParams.get('client_id')||clients[0]?.id;
 const tasks=client?(await db.prepare("SELECT t.*,j.title job_title FROM task_billing t JOIN jobs j ON j.id=t.job_id WHERE t.client_id=? AND t.status='done' AND t.hourly_rate_cents IS NOT NULL AND t.eligible_minutes>t.covered_minutes AND NOT EXISTS(SELECT 1 FROM invoice_lines l WHERE l.task_id=t.id AND l.active=1) ORDER BY t.created_at,t.id").bind(client).all()).results:[];
 return respond(page('Create draft invoice',`<form method="get"><label>Client<select name="client_id" aria-label="Client">${clients.map(c=>`<option value="${c.id}" ${c.id===client?'selected':''}>${esc(c.display_name)}</option>`).join('')}</select></label><button>Show completed work</button></form><p>Select completed tasks below. Prices and pack coverage are saved when you create the draft. Only priced, uncovered work not already on an active invoice is available.</p><form method="post"><input type="hidden" name="id" value="${crypto.randomUUID()}"><input type="hidden" name="version" value=""><input type="hidden" name="client_id" value="${esc(client||'')}">${tasks.map(t=>`<label class="full"><span><input style="width:auto;min-height:auto" type="checkbox" name="task_ids" value="${t.id}"> ${esc(t.job_title)} — ${esc(t.title)} · ${t.eligible_minutes-t.covered_minutes} uncovered minutes · ${money(Math.round((t.eligible_minutes-t.covered_minutes)*t.hourly_rate_cents/60))}</span></label>`).join('')}${tasks.length?'<button class="full">Create draft invoice</button>':'<p>No completed, priced, unbilled tasks with uncovered time for this client.</p>'}</form>`),200,'text/html');
 }
 let v;try{v=await readForm(request,['client_id'],['task_ids'])}catch(e){return respond(e.message,400)}
 if(!uuid.test(v.id)||!uuid.test(v.client_id)||v.version!==''||!v.task_ids.length||v.task_ids.length>100||v.task_ids.some(x=>!uuid.test(x))||new Set(v.task_ids).size!==v.task_ids.length)return respond('Choose between 1 and 100 completed tasks from one client.',400);
 const now=new Date().toISOString();
 try{const result=await db.prepare("INSERT INTO invoices(id,client_id,client_name,selection,created_at,updated_at,changed_by) SELECT ?,id,display_name,?,?,?,? FROM clients WHERE id=? RETURNING id").bind(v.id,JSON.stringify(v.task_ids),now,now,actor,v.client_id).all();if(result.results.length!==1)return respond('Client not found',404)}catch{return respond(page('Draft not saved',`<p role="alert">The selected work changed or is already invoiced. No draft was saved. Reload the selection and try again.</p><a href="${root}/new?client_id=${v.client_id}">Reload completed work</a>`),409,'text/html')}
 return respond('',303,'text/plain',{Location:root+'/'+v.id});
 }
 const invoice=await db.prepare('SELECT * FROM invoices WHERE id=?').bind(id).first();if(!invoice)return respond('Invoice not found',404);
 if(request.method==='POST'){
 let v;try{v=await readForm(request,['status'])}catch(e){return respond(e.message,400)}
 if(v.id!==id||!/^[1-9]\d{0,8}$/.test(v.version)||!['issued','paid','cancelled'].includes(v.status))return respond('Invalid invoice form.',400);
 const allowed=invoice.status==='draft'?['issued','cancelled']:invoice.status==='issued'?['paid','cancelled']:[];
 if(!allowed.includes(v.status))return respond('That invoice status change is not available.',409);
 const now=new Date().toISOString(),r=await db.prepare("UPDATE invoices SET status=?,version=version+1,updated_at=?,changed_by=?,issued_at=CASE WHEN ?='issued' THEN ? ELSE issued_at END,paid_at=CASE WHEN ?='paid' THEN ? ELSE paid_at END WHERE id=? AND version=? AND status=? RETURNING id").bind(v.status,now,actor,v.status,now,v.status,now,id,Number(v.version),invoice.status).all();
 if(r.results.length!==1)return respond('Invoice changed in another session. Reload before trying again.',409);
 return respond('',303,'text/plain',{Location:path});
 }
 const lines=(await db.prepare('SELECT * FROM invoice_lines WHERE invoice_id=? ORDER BY task_id').bind(id).all()).results,states=invoice.status==='draft'?['issued','cancelled']:invoice.status==='issued'?['paid','cancelled']:[];
 return respond(page('Test invoice',`<p>${esc(invoice.client_name)} · ${esc(invoice.status)}</p><p>Reference: ${esc(id)}</p><h2>Total: ${money(lines.reduce((s,l)=>s+l.amount_cents,0))}</h2><p>Saved prices and pack coverage. This test invoice is not sent to the client.</p><ul>${lines.map(l=>`<li>${esc(l.title)}<span>${l.billable_minutes-l.covered_minutes} uncovered minutes at ${money(l.hourly_rate_cents)}/hour · ${money(l.amount_cents)}</span></li>`).join('')}</ul>${states.length?`<form method="post"><input type="hidden" name="id" value="${id}"><input type="hidden" name="version" value="${invoice.version}"><label>Status<select name="status" aria-label="Status">${states.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></label><button>Update invoice status</button></form>`:''}<p>Drafts reserve their tasks. Cancel a draft or issued invoice to release them. Paid invoices are final in this sandbox. Tasks and pack allocations used by an active invoice are locked to preserve its balance.</p>`),200,'text/html');
 }catch{return respond('Could not load or save this test invoice. Please retry.',503)}
}
