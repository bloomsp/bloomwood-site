const root = '/sandbox/clients';
export const fields = ['client_type','display_name','first_name','last_name','business_name','contact_name','contact_role','date_of_birth','email','phone','address','preferred_contact_method','status','tags'];
const choices = {client_type:['person','company'],preferred_contact_method:['email','phone','sms','other'],status:['active','lead','inactive','archived']};
const labels = {client_type:'Client type',display_name:'Display name',first_name:'First name',last_name:'Last name',business_name:'Business name',contact_name:'Contact name',contact_role:'Contact role',date_of_birth:'Date of birth',email:'Email',phone:'Phone',address:'Address',preferred_contact_method:'Preferred contact method',status:'Status',tags:'Tags (comma separated)'};
export const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const page = (title,content) => `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Bloomwood test CRM</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f7f3;color:#213729;font:1rem/1.5 system-ui,sans-serif}main{max-width:56rem;margin:auto;padding:clamp(1rem,4vw,3rem)}nav{display:flex;gap:1rem;flex-wrap:wrap}a{color:#245c3d}header{border-bottom:2px solid #44654f;margin-bottom:1.5rem}h1{line-height:1.2}form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}label{display:flex;flex-direction:column;gap:.3rem}input,select,textarea,button{font:inherit;min-height:44px;border:1px solid #789080;border-radius:.3rem;padding:.55rem;width:100%;background:white;color:inherit}button{background:#245c3d;color:white;cursor:pointer}textarea{min-height:90px}.full{grid-column:1/-1}.error{border:2px solid #a12727;padding:1rem;color:#801b1b}ul{list-style:none;padding:0}li{padding:1rem;background:white;border:1px solid #d6dfd7;margin:.6rem 0;border-radius:.4rem}li span{display:block}*:focus-visible{outline:3px solid #ba6416;outline-offset:3px}@media(max-width:600px){form{grid-template-columns:1fr}}
</style></head><body><main><header><nav><a href="${root}">Test clients</a><a href="/sandbox/jobs">Test jobs</a><a href="/sandbox/services">Services</a><a href="/sandbox/packs">Service packs</a><a href="/sandbox/invoices">Invoices</a><a href="/sandbox/deliveries">Files</a><a href="/directory">Read-only snapshot</a></nav><h1>${esc(title)}</h1><p><strong>Editing sandbox — fictional data only.</strong> Changes here do not update the live CRM or the migration snapshot.</p></header>${content}</main></body></html>`;
function form(values, action, error='') {
 return page(values.version ? 'Edit test client' : 'Create test client',`${error ? `<p role="alert" class="error">${esc(error)}</p>` : ''}<form method="post" action="${esc(action)}">
 <input type="hidden" name="id" value="${esc(values.id)}"><input type="hidden" name="version" value="${esc(values.version ?? '')}">
 ${fields.map(k=>`<label${k==='address'?' class="full"':''}><span id="${k}-label">${labels[k]}</span>${choices[k]?`<select name="${k}" aria-labelledby="${k}-label">${choices[k].map(v=>`<option value="${v}" ${values[k]===v?'selected':''}>${esc(v)}</option>`).join('')}</select>`:k==='address'?`<textarea name="${k}" maxlength="2000">${esc(values[k])}</textarea>`:`<input name="${k}" type="${k==='date_of_birth'?'date':k==='email'?'email':'text'}" value="${esc(values[k])}" maxlength="${k==='tags'?1000:200}" ${k==='display_name'?'required':''}>`}</label>`).join('')}
 <p class="full">For a person, enter a first or last name. For a company, enter a business name.</p><button class="full">Save test client</button></form>`);
}
export async function readForm(request, expectedFields = fields, repeatedFields = []) {
 if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new Error('Use the client form to save changes.');
 const reader=request.body?.getReader(); if(!reader)throw new Error('Form is empty.');
 let size=0,parts=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw new Error('Form is too large.');}parts.push(value)}
 const bytes=new Uint8Array(size);let pos=0;for(const p of parts){bytes.set(p,pos);pos+=p.length}
 const f=new URLSearchParams(new TextDecoder().decode(bytes)), v={};
 for(const k of ['id','version',...expectedFields]){if(f.getAll(k).length!==1)throw new Error('Form fields are missing or duplicated.');v[k]=f.get(k).trim();}
 for(const k of repeatedFields)v[k]=f.getAll(k);
 return v;
}
export function validateClient(v) {
 for(const k of fields)if(v[k].length>(k==='address'?2000:k==='tags'?1000:200))return labels[k]+' is too long.';
 for(const [k,options] of Object.entries(choices))if(!options.includes(v[k]))return 'Choose a valid '+labels[k].toLowerCase()+'.';
 if(!v.display_name)return 'Display name is required.';
 if(v.client_type==='person'&&!v.first_name&&!v.last_name)return 'Enter a first or last name.';
 if(v.client_type==='company'&&!v.business_name)return 'Business name is required.';
 if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))return 'Enter a valid email address.';
 if(v.date_of_birth&&(!/^\d{4}-\d{2}-\d{2}$/.test(v.date_of_birth)||!Number.isFinite(Date.parse(v.date_of_birth))||new Date(v.date_of_birth).toISOString().slice(0,10)!==v.date_of_birth||v.date_of_birth>new Date().toISOString().slice(0,10)))return 'Enter a valid date of birth that is not in the future.';
 return '';
}
export async function clientEditor(request, env, actor, respond) {
 const {pathname,origin}=new URL(request.url);
 if(!env.EDITING_DB)return respond('Editing sandbox unavailable',503);
 const isNew=pathname===root+'/new', match=pathname.match(/^\/sandbox\/clients\/([0-9a-f-]+)\/edit$/), id=match?.[1];
 if(pathname!==root&&!isNew&&!(id&&uuid.test(id)))return respond('Not found',404);
 if(!['GET','POST'].includes(request.method)||request.method==='POST'&&pathname===root)return respond('Method not allowed',405,'text/plain',{Allow:'GET'});
 if(request.method==='POST'&&(request.headers.get('origin')!==origin||['cross-site','same-site'].includes(request.headers.get('sec-fetch-site'))))return respond('Reload this page and submit from the CRM.',403);
 const db=env.EDITING_DB;
 try {
 if(request.method==='GET'){
  if(pathname===root){const {results}=await db.prepare('SELECT id,display_name,status FROM clients ORDER BY display_name COLLATE NOCASE,id').all();return respond(page('Test clients',`<a href="${root}/new">Create test client</a><ul>${results.map(r=>`<li><a href="${root}/${esc(r.id)}/edit">${esc(r.display_name)}</a><span>${esc(r.status)}</span></li>`).join('')}</ul>`),200,'text/html')}
  const v=isNew?{id:crypto.randomUUID(),client_type:'person',preferred_contact_method:'email',status:'active'}:await db.prepare('SELECT * FROM clients WHERE id=?').bind(id).first();
  if(!v)return respond('Client not found',404);
  if(!isNew)v.tags=JSON.parse(v.tags).join(', ');
  return respond(form(v,pathname),200,'text/html');
 }
 let v;try{v=await readForm(request)}catch(e){return respond(e.message,400)}
 if(!uuid.test(v.id)||(!isNew&&v.id!==id)||(isNew?v.version!=='':!/^[1-9]\d{0,8}$/.test(v.version)))return respond('Invalid form. Reload the client.',400);
 const error=validateClient(v);if(error)return respond(form(v,pathname,error),400,'text/html');
 const now=new Date().toISOString(), values=fields.map(k=>k==='tags'?JSON.stringify(v.tags.split(',').map(t=>t.trim()).filter(Boolean)):v[k]||null);
 if(isNew){
  const result=await db.prepare('INSERT INTO clients (id,'+fields.join(',')+',created_at,updated_at,changed_by) VALUES (?,'+fields.map(()=>'?').join(',')+',?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id').bind(v.id,...values,now,now,actor).all();
  if(result.results?.length!==1)return respond(form(v,pathname,'This form has already been saved. Return to test clients.'),409,'text/html');
 }else{
  const result=await db.prepare('UPDATE clients SET '+fields.map(k=>k+'=?').join(',')+',updated_at=?,changed_by=?,version=version+1 WHERE id=? AND version=? RETURNING id').bind(...values,now,actor,id,Number(v.version)).all();
  if(result.results?.length!==1)return respond(form(v,pathname,'This client changed in another session. Your edits were not saved. Copy your changes, then reload the client.'),409,'text/html');
 }
 return respond('',303,'text/plain',{Location:root+'/'+v.id+'/edit'});
 }catch{return respond('Could not load or save this test client. Please retry.',503)}
}
