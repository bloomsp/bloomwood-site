import {page,esc,uuid,readForm} from './client-editor.mjs';
const root='/sandbox/deliveries',limit=5242880;
async function uploadForm(request){
 if(!request.headers.get('content-type')?.startsWith('multipart/form-data;'))throw Error('Choose a file using the upload form.');
 const reader=request.body?.getReader();if(!reader)throw Error('Choose a file.');
 const parts=[];let length=0;for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit+16384){await reader.cancel();throw Error('Maximum file size is 5 MB.')}parts.push(value)}
 const bytes=new Uint8Array(length);let pos=0;for(const part of parts){bytes.set(part,pos);pos+=part.length}
 const form=await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')}}).formData();
 for(const k of ['id','job_id','file'])if(form.getAll(k).length!==1)throw Error('Invalid upload form.');
 const id=form.get('id'),job=form.get('job_id'),file=form.get('file');
 if(typeof id!=='string'||!uuid.test(id)||typeof job!=='string'||!uuid.test(job)||typeof file==='string'||!file?.size||file.size>limit||!file.name||file.name.length>200||/[\x00-\x1f\x7f/\\]/.test(file.name))throw Error('Choose a valid job and a file up to 5 MB with a simple filename.');
 return {id,job,file};
}
export async function deliveryEditor(request,env,actor,respond){
 const url=new URL(request.url),path=url.pathname,list=path===root,isNew=path===root+'/new',match=path.match(/^\/sandbox\/deliveries\/([0-9a-f-]+)(\/download)?$/),id=match?.[1],download=!!match?.[2];
 if(!list&&!isNew&&!(id&&uuid.test(id)))return respond('Not found',404);
 if(!['GET','POST'].includes(request.method)||request.method==='POST'&&(list||download))return respond('Method not allowed',405,'text/plain',{Allow:'GET'});
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||['cross-site','same-site'].includes(request.headers.get('sec-fetch-site'))))return respond('Submit from the CRM.',403);
 const db=env.EDITING_DB,bucket=env.EDITING_FILES;if(!db||!bucket)return respond('Test file storage is not configured.',503);
 try{
 if(list){const rows=(await db.prepare('SELECT d.*,j.title FROM deliveries d JOIN jobs j ON j.id=d.job_id ORDER BY d.created_at DESC,d.id').all()).results;return respond(page('Test file deliveries',`<a href="${root}/new">Upload test file</a><p>Staff-only test files. These links cannot be sent to clients.</p><ul>${rows.map(d=>`<li><a href="${root}/${d.id}">${esc(d.filename)}</a><span>${esc(d.title)} · ${esc(d.status)}</span></li>`).join('')}</ul>`),200,'text/html')}
 if(isNew){
 if(request.method==='GET'){const jobs=(await db.prepare('SELECT id,title FROM jobs ORDER BY created_at DESC,id').all()).results;return respond(page('Upload test file',`<p>Fictional files only, up to 5 MB. Downloads expire after seven days and require approved staff sign-in.</p><form method="post" enctype="multipart/form-data"><input type="hidden" name="id" value="${crypto.randomUUID()}"><label>Job<select name="job_id" aria-label="Job">${jobs.map(j=>`<option value="${j.id}">${esc(j.title)}</option>`).join('')}</select></label><label>Test file<input type="file" name="file" required></label><button>Upload test file</button></form>`),200,'text/html')}
 let v;try{v=await uploadForm(request)}catch(e){return respond(e.message,400)}
 const now=new Date().toISOString(),expires=new Date(Date.now()+7*86400000).toISOString(),key='sandbox/'+v.id;
 const inserted=await db.prepare("INSERT INTO deliveries(id,job_id,filename,size_bytes,object_key,status,expires_at,changed_by,created_at,updated_at) SELECT ?,id,?,?,?,'uploading',?,?,?,? FROM jobs WHERE id=? ON CONFLICT(id) DO NOTHING RETURNING id").bind(v.id,v.file.name,v.file.size,key,expires,actor,now,now,v.job).all();
 if(inserted.results.length!==1)return respond('Upload already submitted or job not found. Reload the file list.',409);
 await bucket.put(key,await v.file.arrayBuffer(),{httpMetadata:{contentType:'application/octet-stream'}});
 await db.prepare("UPDATE deliveries SET status='ready',version=version+1,updated_at=?,changed_by=? WHERE id=? AND status='uploading'").bind(new Date().toISOString(),actor,v.id).run();
 return respond('',303,'text/plain',{Location:root+'/'+v.id});
 }
 const d=await db.prepare('SELECT d.*,j.title,c.display_name,c.email FROM deliveries d JOIN jobs j ON j.id=d.job_id JOIN clients c ON c.id=j.client_id WHERE d.id=?').bind(id).first();if(!d)return respond('File not found',404);
 if(download){
 if(d.status!=='ready'||d.expires_at<=new Date().toISOString())return respond('This file is revoked, expired or not ready.',410);
 const object=await bucket.get(d.object_key);if(!object)return respond('File unavailable',404);
 const now=new Date().toISOString();const claim=await db.prepare("INSERT INTO delivery_downloads(delivery_id,actor,created_at) SELECT id,?,? FROM deliveries WHERE id=? AND status='ready' AND expires_at>? RETURNING id").bind(actor,now,id,now).all();
 if(!claim.results.length)return respond('File no longer available.',410);
 return respond(object.body,200,'application/octet-stream',{'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(d.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))});
 }
 if(request.method==='POST'){
 let v;try{v=await readForm(request,['action'])}catch(e){return respond(e.message,400)}
 if(v.id!==id||!/^\d{1,9}$/.test(v.version)||v.action!=='revoke')return respond('Invalid form',400);
 const r=await db.prepare("UPDATE deliveries SET status='revoked',version=version+1,updated_at=?,changed_by=? WHERE id=? AND version=? AND status!='revoked' RETURNING id").bind(new Date().toISOString(),actor,id,Number(v.version)).all();if(!r.results.length)return respond('File changed. Reload before trying again.',409);
 return respond('',303,'text/plain',{Location:path});
 }
 const active=d.status==='ready'&&d.expires_at>new Date().toISOString();
 return respond(page('Test file delivery',`<h2>${esc(d.filename)}</h2><p>Job: <a href="/sandbox/jobs/${d.job_id}/edit">${esc(d.title)}</a></p><p>${esc(d.status)} · ${d.size_bytes} bytes · expires ${esc(d.expires_at)}</p>${active?`<a href="${path}/download">Download test file</a>`:'<p>Download unavailable.</p>'}${d.status!=='revoked'?`<form method="post"><input type="hidden" name="id" value="${id}"><input type="hidden" name="version" value="${d.version}"><input type="hidden" name="action" value="revoke"><button>Revoke file access</button></form>`:''}<h2>Delivery message preview</h2><p>Not sent. A client-accessible link and verified email sender are still required.</p><p>Recipient: ${esc(d.email||'No client email recorded')}</p><p>Subject: Files for ${esc(d.title)}</p><blockquote>Hello ${esc(d.display_name)},<br>Your file ${esc(d.filename)} is ready for delivery.<br>[Client download link will be added after client delivery is enabled.]</blockquote>`),200,'text/html');
 }catch{return respond('Could not load or save the test delivery. Check the file list before retrying an upload.',503)}
}
