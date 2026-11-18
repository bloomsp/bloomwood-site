import {esc,uuid,page,readForm} from './client-editor.mjs';
const jobFields=['client_id','title','details','status'];
const taskFields=['title','details','status','billable_minutes','non_billable_minutes'];
const closed=s=>['completed','cancelled'].includes(s);
const select=(name,label,options,value)=>`<label><span id="${name}-label">${label}</span><select name="${name}" aria-labelledby="${name}-label">${options.map(([id,text])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
function form(v,path,task,clients,error='',extra=''){
 const states=task?['open','done','cancelled']:['open','in_progress','completed','cancelled'];
 return page(`${v.version?'Edit':'Create'} test ${task?'task':'job'}`,`${error?`<p role="alert" class="error">${esc(error)}</p>`:''}<form method="post" action="${esc(path)}"><input type="hidden" name="id" value="${esc(v.id)}"><input type="hidden" name="version" value="${esc(v.version||'')}">${task?'':v.version?`<input type="hidden" name="client_id" value="${esc(v.client_id)}"><p class="full">Client: <a href="/sandbox/clients/${esc(v.client_id)}/edit">${esc(clients.find(c=>c.id===v.client_id)?.display_name)}</a></p>`:select('client_id','Client',clients.map(c=>[c.id,c.display_name]),v.client_id)}<label>Title<input name="title" maxlength="200" required value="${esc(v.title)}"></label>${select('status','Status',states.map(s=>[s,s]),v.status)}<label class="full">Details<textarea name="details" maxlength="4000">${esc(v.details)}</textarea></label>${task?['billable_minutes','non_billable_minutes'].map(k=>`<label>${k==='billable_minutes'?'Billable minutes':'Non-billable minutes'}<input type="number" name="${k}" min="0" max="1000000" step="1" required value="${esc(v[k]??0)}"></label>`).join(''):''}<button class="full">Save test ${task?'task':'job'}</button></form>${extra}`);
}
export async function workEditor(request,env,actor,respond){
 const {pathname:path,origin}=new URL(request.url),db=env.EDITING_DB;
 const newJob=path==='/sandbox/jobs/new', jobMatch=path.match(/^\/sandbox\/jobs\/([0-9a-f-]+)\/edit$/),newTaskMatch=path.match(/^\/sandbox\/jobs\/([0-9a-f-]+)\/tasks\/new$/),taskMatch=path.match(/^\/sandbox\/tasks\/([0-9a-f-]+)\/edit$/);
 const list=path==='/sandbox/jobs',task=!!(newTaskMatch||taskMatch),isNew=newJob||!!newTaskMatch,id=(jobMatch||newTaskMatch||taskMatch)?.[1];
 if(!list&&!newJob&&!(id&&uuid.test(id)))return respond('Not found',404);
 if(!['GET','POST'].includes(request.method)||(list&&request.method!=='GET'))return respond('Method not allowed',405,'text/plain',{Allow:'GET'});
 if(request.method==='POST'&&(request.headers.get('origin')!==origin||['cross-site','same-site'].includes(request.headers.get('sec-fetch-site'))))return respond('Reload this page and submit from the CRM.',403);
 if(!db)return respond('Editing sandbox unavailable',503);
 try{
 if(list){const {results}=await db.prepare('SELECT j.*,c.display_name FROM jobs j JOIN clients c ON c.id=j.client_id ORDER BY j.created_at DESC,j.id').all();return respond(page('Test jobs',`<a href="/sandbox/jobs/new">Create test job</a><ul>${results.map(j=>`<li><a href="/sandbox/jobs/${esc(j.id)}/edit">${esc(j.title)}</a><span>${esc(j.display_name)} · ${esc(j.status)}</span></li>`).join('')}</ul>`),200,'text/html')}
 const clients=(await db.prepare('SELECT id,display_name FROM clients ORDER BY display_name,id').all()).results;
 const existing=isNew?null:await db.prepare(`SELECT * FROM ${task?'tasks':'jobs'} WHERE id=?`).bind(id).first();
 if(!isNew&&!existing)return respond('Record not found',404);
 const parent=task?await db.prepare('SELECT * FROM jobs WHERE id=?').bind(newTaskMatch?id:existing.job_id).first():null;
 if(task&&!parent)return respond('Job not found',404);
 let extra='';
 if(task)extra=`<p><a href="/sandbox/jobs/${esc(parent.id)}/edit">Back to ${esc(parent.title)}</a></p>`;
 if(!task&&existing){const rows=(await db.prepare('SELECT * FROM tasks WHERE job_id=? ORDER BY created_at,id').bind(id).all()).results;
 const active=rows.filter(t=>t.status!=='cancelled'),bill=active.reduce((a,t)=>a+t.billable_minutes,0),non=active.reduce((a,t)=>a+t.non_billable_minutes,0);
 extra=`<h2>Tasks and time</h2><p>Recorded time (open and done tasks; cancelled tasks excluded): <strong>${bill} billable minutes</strong>, ${non} non-billable minutes; ${bill+non} total minutes.</p>${closed(existing.status)?'<p>Reopen this job to add or edit tasks.</p>':`<a href="/sandbox/jobs/${id}/tasks/new">Add test task</a>`}<ul>${rows.map(t=>`<li><a href="/sandbox/tasks/${esc(t.id)}/edit">${esc(t.title)}</a><span>${esc(t.status)} · ${t.time_taken_minutes} minutes</span></li>`).join('')}</ul>`;
 }
 if(task&&closed(parent.status))return respond(page('Job is closed',`<p>Reopen the job before adding or editing tasks.</p>${extra}`),409,'text/html');
 if(request.method==='GET')return respond(form(existing||{id:crypto.randomUUID(),status:'open'},path,task,clients,'',extra),200,'text/html');
 let v;try{v=await readForm(request,task?taskFields:jobFields)}catch(e){return respond(e.message,400)}
 if(!uuid.test(v.id)||(!isNew&&v.id!==id)||(isNew?v.version!=='':!/^[1-9]\d{0,8}$/.test(v.version)))return respond('Invalid form. Reload this record.',400);
 let error=!v.title||v.title.length>200?'Enter a title of up to 200 characters.':v.details.length>4000?'Details are too long.':!(task?['open','done','cancelled']:['open','in_progress','completed','cancelled']).includes(v.status)?'Choose a valid status.':'';
 if(task&&['billable_minutes','non_billable_minutes'].some(k=>!/^\d{1,7}$/.test(v[k])||Number(v[k])>1000000))error='Enter whole minutes between 0 and 1000000.';
 if(!task&&(!clients.some(c=>c.id===v.client_id)||existing&&existing.client_id!==v.client_id))error='Choose a valid client. An existing job cannot change clients.';
 if(error)return respond(form(v,path,task,clients,error,extra),400,'text/html');
 const now=new Date().toISOString();let result;
 if(task){const completed=v.status==='done'?(existing?.completed_at||now):null;
 if(isNew)result=await db.prepare("INSERT INTO tasks(id,job_id,client_id,title,details,status,billable_minutes,non_billable_minutes,completed_at,created_at,updated_at,changed_by) SELECT ?,id,client_id,?,?,?,?,?,?,?,?,? FROM jobs WHERE id=? AND status IN ('open','in_progress') ON CONFLICT(id) DO NOTHING RETURNING id").bind(v.id,v.title,v.details,v.status,Number(v.billable_minutes),Number(v.non_billable_minutes),completed,now,now,actor,parent.id).all();
 else result=await db.prepare("UPDATE tasks SET title=?,details=?,status=?,billable_minutes=?,non_billable_minutes=?,completed_at=?,updated_at=?,changed_by=?,version=version+1 WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM jobs WHERE id=tasks.job_id AND status IN ('open','in_progress')) RETURNING id").bind(v.title,v.details,v.status,Number(v.billable_minutes),Number(v.non_billable_minutes),completed,now,actor,id,Number(v.version)).all();
 }else{
 const ended=closed(v.status)?existing?.closed_at||now:null;
 if(isNew)result=await db.prepare('INSERT INTO jobs(id,client_id,title,details,status,created_at,updated_at,closed_at,changed_by) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id').bind(v.id,v.client_id,v.title,v.details,v.status,now,now,ended,actor).all();
 else result=await db.prepare("UPDATE jobs SET title=?,details=?,status=?,updated_at=?,closed_at=?,changed_by=?,version=version+1 WHERE id=? AND version=? AND (? NOT IN ('completed','cancelled') OR NOT EXISTS(SELECT 1 FROM tasks WHERE job_id=jobs.id AND status='open')) RETURNING id").bind(v.title,v.details,v.status,now,ended,actor,id,Number(v.version),v.status).all();
 }
 if(result.results?.length!==1)return respond(form(v,path,task,clients,'Not saved: this form was already saved, the record changed, or the job still has open tasks. Copy your edits and reload.',extra),409,'text/html');
 return respond('',303,'text/plain',{Location:`/sandbox/${task?'tasks':'jobs'}/${v.id}/edit`});
 }catch{return respond('Could not load or save this test record. Please retry.',503)}
}
