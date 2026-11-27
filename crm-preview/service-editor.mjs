import {taskInvoiceLinks} from './invoice-links.mjs';
import {esc,uuid,page,readForm} from './client-editor.mjs';
export function allocation(tasks,capacity){
 let remaining=capacity;
 return [...tasks].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)).map(t=>{
 const minutes=t.status==='cancelled'?0:t.billable_minutes,covered=Math.min(remaining,minutes);remaining-=covered;
 return {...t,covered,overflow:minutes-covered,remaining};
 });
}
const pick=(name,label,rows,value,optional=false)=>`<label>${label}<select name="${name}" aria-label="${label}">${optional?'<option value="">None</option>':''}${rows.map(r=>`<option value="${esc(r.id)}" ${r.id===value?'selected':''}>${esc(r.name||r.display_name)}</option>`).join('')}</select></label>`;
const input=(name,label,value,type='text',step='1')=>`<label>${label}<input name="${name}" value="${esc(value)}" type="${type}" ${type==='number'?`min="0" step="${step}"`: 'maxlength="200"'} required></label>`;
export async function serviceEditor(request,env,actor,respond){
 const {pathname:path,origin}=new URL(request.url);
 const match=path.match(/^\/sandbox\/(services|packs)(?:\/(new|[0-9a-f-]+)(\/edit)?)?$/),assignment=path.match(/^\/sandbox\/allocations\/([0-9a-f-]+)$/);
 if(!match&&!assignment)return respond('Not found',404);
 const kind=assignment?'allocation':match[1],id=assignment?.[1]||match?.[2],isNew=id==='new',list=!id;
 if(id&&!isNew&&!uuid.test(id)||match&&(isNew&&match[3]||!list&&!isNew&&!match[3]))return respond('Not found',404);
 if(!['GET','POST'].includes(request.method)||list&&request.method==='POST')return respond('Method not allowed',405,'text/plain',{Allow:'GET'});
 if(request.method==='POST'&&(request.headers.get('origin')!==origin||['cross-site','same-site'].includes(request.headers.get('sec-fetch-site'))))return respond('Reload and submit from the CRM.',403);
 const db=env.EDITING_DB;if(!db)return respond('Sandbox unavailable',503);
 try{
 const services=(await db.prepare('SELECT * FROM service_types ORDER BY name,id').all()).results;
 const clients=(await db.prepare('SELECT id,display_name FROM clients ORDER BY display_name,id').all()).results;
 const packs=(await db.prepare('SELECT * FROM service_packs ORDER BY name,id').all()).results;
 if(list){const rows=kind==='services'?services:packs;return respond(page(kind==='services'?'Test services':'Test service packs',`<a href="${path}/new">Create ${kind==='services'?'service type':'service pack'}</a><ul>${rows.map(r=>`<li><a href="${path}/${esc(r.id)}/edit">${esc(r.name)}</a><span>${kind==='services'?`$${(r.hourly_rate_cents/100).toFixed(2)} per hour`:esc(clients.find(c=>c.id===r.client_id)?.display_name)+' · '+r.purchased_minutes+' purchased minutes'}</span></li>`).join('')}</ul>`),200,'text/html')}
 const table=kind==='services'?'service_types':kind==='packs'?'service_packs':'tasks';
 const current=isNew?null:await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first();
 if(!isNew&&!current)return respond('Record not found',404);
 if(kind==='allocation'){const links=await taskInvoiceLinks(db,current);if(links)return respond(page('Allocation reserved',`<p>This task or shared pack is reserved. Cancel the draft or issued invoice before editing. Paid invoices are final in this sandbox.</p>${links}`),409,'text/html')}
 let summary='';
 if(kind==='packs'&&current){const tasks=(await db.prepare('SELECT * FROM tasks WHERE service_pack_id=? ORDER BY created_at,id').bind(id).all()).results,rows=allocation(tasks,current.purchased_minutes),used=rows.reduce((s,t)=>s+t.covered,0),overflow=rows.reduce((s,t)=>s+t.overflow,0);
 const sale=current.invoice_source?await db.prepare('SELECT invoice_id FROM invoice_pack_grants WHERE source_key=?').bind(current.invoice_source).first():null;
 summary=`${sale?`<p>Activated from <a href="/sandbox/invoices/${sale.invoice_id}/xero">paid Xero invoice</a>.</p>`:''}<h2>Pack balance</h2><p>${used} used minutes · ${current.purchased_minutes-used} remaining minutes · ${overflow} overflow minutes</p><p>Open and completed tasks reserve billable time in creation order. Cancelled tasks and non-billable time use no pack minutes. Overflow is time beyond the purchased allowance.</p><ul>${rows.map(t=>`<li><a href="/sandbox/tasks/${esc(t.id)}/edit">${esc(t.title)}</a><span>${t.covered} covered · ${t.overflow} overflow minutes</span></li>`).join('')}</ul>`;
 }
 if(kind==='allocation'){
 const job=await db.prepare('SELECT status FROM jobs WHERE id=?').bind(current.job_id).first();
 if(['completed','cancelled'].includes(job?.status))return respond('Reopen the job before changing task allocation.',409);
 summary=`<p><a href="/sandbox/tasks/${id}/edit">Back to task</a></p><p>Choose a service, then an optional pack for the same service and client. Rates are current reference rates; no invoice is created.</p>`;
 }
 const render=(v,error='')=>page(kind==='services'?'Service type':kind==='packs'?'Service pack':'Task service allocation',`${error?`<p role="alert" class="error">${esc(error)}</p>`:''}<form method="post" action="${path}"><input type="hidden" name="id" value="${esc(v.id)}"><input type="hidden" name="version" value="${esc(v.version||'')}">${kind==='allocation'?pick('service_type_id','Service type',services,v.service_type_id,true)+pick('service_pack_id','Service pack',packs.filter(p=>p.client_id===current.client_id),v.service_pack_id,true):input('name','Name',v.name||'')+(kind==='services'?input('hourly_rate','Hourly rate (AUD)',v.hourly_rate??((v.hourly_rate_cents||0)/100).toFixed(2),'number','0.01'):current?`<input type="hidden" name="client_id" value="${esc(current.client_id)}"><input type="hidden" name="service_type_id" value="${esc(current.service_type_id)}"><p>Client: ${esc(clients.find(c=>c.id===current.client_id)?.display_name)}<br>Service: ${esc(services.find(s=>s.id===current.service_type_id)?.name)}</p>`+input('purchased_minutes','Purchased minutes',v.purchased_minutes??0,'number'):pick('client_id','Client',clients,v.client_id)+pick('service_type_id','Service type',services,v.service_type_id)+input('purchased_minutes','Purchased minutes',v.purchased_minutes??0,'number'))}<button class="full">Save ${kind==='services'?'service type':kind==='packs'?'service pack':'allocation'}</button></form>${summary}`);
 if(request.method==='GET')return respond(render(current||{id:crypto.randomUUID()}),200,'text/html');
 const fields=kind==='services'?['name','hourly_rate']:kind==='packs'?['name','client_id','service_type_id','purchased_minutes']:['service_type_id','service_pack_id'];
 let v;try{v=await readForm(request,fields)}catch(e){return respond(e.message,400)}
 if(!uuid.test(v.id)||!isNew&&v.id!==id||(isNew?v.version!=='':!/^[1-9]\d{0,8}$/.test(v.version)))return respond('Invalid form. Reload.',400);
 let error='';
 if(kind!=='allocation'&&(!v.name||v.name.length>200))error='Enter a name of up to 200 characters.';
 if(kind==='services'&&(!/^\d{1,7}(\.\d{1,2})?$/.test(v.hourly_rate)||Number(v.hourly_rate)>1000000))error='Enter a valid rate up to 1000000 AUD, with at most two decimal places.';
 if(kind==='packs'&&(!/^\d{1,7}$/.test(v.purchased_minutes)||Number(v.purchased_minutes)>1000000||!clients.some(c=>c.id===v.client_id)||!services.some(s=>s.id===v.service_type_id)||current&&(current.client_id!==v.client_id||current.service_type_id!==v.service_type_id)))error='Choose a valid client and service and whole purchased minutes (0–1000000). Existing pack links cannot change.';
 if(kind==='allocation'&&(v.service_type_id&&!services.some(s=>s.id===v.service_type_id)||v.service_pack_id&&!packs.some(p=>p.id===v.service_pack_id&&p.client_id===current.client_id&&p.service_type_id===v.service_type_id)))error='The pack must match this task’s client and selected service.';
 if(error)return respond(render(v,error),400,'text/html');
 if(kind==='packs'&&current&&Number(v.purchased_minutes)!==current.purchased_minutes&&await db.prepare('SELECT 1 FROM invoice_lines WHERE active=1 AND service_pack_id=? LIMIT 1').bind(id).first())return respond(render(v,'This allowance is reserved by an active invoice. Cancel that invoice before changing the allowance.'),409,'text/html');
 if(kind==='allocation'&&v.service_pack_id&&await db.prepare('SELECT 1 FROM invoice_lines WHERE active=1 AND service_pack_id=? LIMIT 1').bind(v.service_pack_id).first())return respond(render(v,'This pack is reserved by an active invoice. Choose another pack or cancel the invoice.'),409,'text/html');
 const now=new Date().toISOString();let result;
 if(kind==='allocation')result=await db.prepare("UPDATE tasks SET service_type_id=?,service_pack_id=?,version=version+1,changed_by=?,updated_at=? WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM jobs WHERE id=tasks.job_id AND status IN ('open','in_progress')) RETURNING id").bind(v.service_type_id||null,v.service_pack_id||null,actor,now,id,Number(v.version)).all();
 else{
 const cols=kind==='services'?['name','hourly_rate_cents']:['name','client_id','service_type_id','purchased_minutes'],values=kind==='services'?[v.name,Math.round(Number(v.hourly_rate)*100)]:[v.name,v.client_id,v.service_type_id,Number(v.purchased_minutes)];
 result=isNew?await db.prepare(`INSERT INTO ${table}(id,${cols.join(',')},changed_by,updated_at) VALUES(?,${cols.map(()=>'?').join(',')},?,?) ON CONFLICT(id) DO NOTHING RETURNING id`).bind(v.id,...values,actor,now).all():await db.prepare(`UPDATE ${table} SET ${cols.map(c=>c+'=?').join(',')},version=version+1,changed_by=?,updated_at=? WHERE id=? AND version=? RETURNING id`).bind(...values,actor,now,id,Number(v.version)).all();
 }
 if(result.results?.length!==1)return respond(render(v,'Not saved: this record changed or the form was already saved. Copy your edits and reload.'),409,'text/html');
 return respond('',303,'text/plain',{Location:kind==='allocation'?path:`/sandbox/${kind}/${v.id}/edit`});
 }catch{return respond('Could not load or save this test record. Please retry.',503)}
}
