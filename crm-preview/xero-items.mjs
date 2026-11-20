import {page,esc,uuid,readForm} from './client-editor.mjs';
import {xeroSession,xeroApi} from './xero-connection.mjs';
const root='/sandbox/items';
export const isPack=code=>/spack/i.test(code);
export function scaled(value,places){const s=String(value);if(!new RegExp('^\\d+(\\.\\d{1,'+places+'})?$').test(s))throw Error('Invalid number');const [a,b='']=s.split('.');const n=Number(a)*10**places+Number(b.padEnd(places,'0'));if(!Number.isSafeInteger(n))throw Error('Number too large');return n}
export function itemAmount(q,p,d){return Number((BigInt(q)*BigInt(p)*BigInt(10000-d)+5000000000n)/10000000000n)}
export async function catalogue(request,env,actor,respond){
 const url=new URL(request.url);if(url.pathname!==root)return respond('Not found',404);
 if(!['GET','POST'].includes(request.method))return respond('Method not allowed',405);
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||['cross-site','same-site'].includes(request.headers.get('sec-fetch-site'))))return respond('Submit from the CRM.',403);
 try{
 const session=await xeroSession(env),r=await (env.XERO_FETCH||fetch)('https://api.xero.com/connections',{headers:{Authorization:'Bearer '+session.token},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Connections unavailable');
 const connections=await r.json();const selected=await env.XERO_DB.prepare('SELECT * FROM catalogue_selection WHERE id=1').first();
 if(request.method==='POST'){
 const v=await readForm(request,['tenant_id']);if(!connections.some(c=>c.tenantId===v.tenant_id))return respond('Reconnect Xero to authorise that catalogue.',400);
 const source={...session,tenant:v.tenant_id},org=(await xeroApi(env,source,'Organisation')).Organisations?.[0];if(!org||org.BaseCurrency!=='AUD')return respond('Choose an AUD organisation.',400);
 const data=await xeroApi(env,source,'Items?unitdp=4');if(!Array.isArray(data.Items))throw Error('Invalid catalogue response');
 const now=new Date().toISOString(),statements=[env.EDITING_DB.prepare('UPDATE xero_items SET active=0 WHERE tenant_id=?').bind(source.tenant)];
 for(const item of data.Items){if(!item.IsSold)continue;const price=item.SalesDetails?.UnitPrice==null?null:scaled(item.SalesDetails.UnitPrice,4);if(!uuid.test(item.ItemID||'')||typeof item.Code!=='string'||item.Code.length>30||price!=null&&price>10000000000)throw Error('Unsupported catalogue item');
 statements.push(env.EDITING_DB.prepare('INSERT INTO xero_items(tenant_id,item_id,code,name,description,price_4,account_code,tax_type,is_pack,active,synced_at) VALUES(?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(tenant_id,item_id) DO UPDATE SET code=excluded.code,name=excluded.name,description=excluded.description,price_4=excluded.price_4,account_code=excluded.account_code,tax_type=excluded.tax_type,is_pack=excluded.is_pack,active=1,synced_at=excluded.synced_at').bind(source.tenant,item.ItemID,item.Code,item.Name||item.Code,item.Description||'',price,item.SalesDetails?.AccountCode||null,item.SalesDetails?.TaxType||null,isPack(item.Code)?1:0,now));
 }
 await env.EDITING_DB.batch(statements);
 await env.XERO_DB.prepare('INSERT INTO catalogue_selection(id,tenant_id,name) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET tenant_id=excluded.tenant_id,name=excluded.name').bind(source.tenant,org.Name).run();
 return respond('',303,'text/plain',{Location:root});
 }
 const rows=selected?(await env.EDITING_DB.prepare('SELECT * FROM xero_items WHERE tenant_id=? AND active=1 ORDER BY code').bind(selected.tenant_id).all()).results:[];
 return respond(page('Xero product catalogue',`<p>Read-only import. Invoice creation remains in Demo Company. Connect Bloomwood in <a href="/sandbox/xero">Xero setup</a> if it is not listed.</p><form method="post"><input type="hidden" name="id" value="sync"><input type="hidden" name="version" value=""><label>Catalogue organisation<select name="tenant_id" aria-label="Catalogue organisation">${connections.map(c=>`<option value="${esc(c.tenantId)}" ${selected?.tenant_id===c.tenantId?'selected':''}>${esc(c.tenantName)}</option>`).join('')}</select></label><button>Load products from Xero</button></form><p>${esc(selected?.name||'No catalogue loaded')} · ${rows.length} products</p><ul>${rows.map(i=>`<li><strong>${esc(i.code)} — ${esc(i.name)}</strong><span>${i.is_pack?'Service-pack product · ':''}${i.price_4==null?'Price not set':'$'+(i.price_4/10000).toFixed(4)}</span></li>`).join('')}</ul>`),200,'text/html');
 }catch{return respond(page('Catalogue connection needed','<p>Connect Xero and authorise both the Demo Company and live Bloomwood organisation. Live catalogue access is read-only.</p><a href="/sandbox/xero">Xero setup</a>'),503,'text/html')}
}
export async function taskItems(request,env,actor,respond){
 const url=new URL(request.url),m=url.pathname.match(/^\/sandbox\/tasks\/([0-9a-f-]+)\/items$/),id=m?.[1];if(!id||!uuid.test(id))return respond('Not found',404);
 if(!['GET','POST'].includes(request.method))return respond('Method not allowed',405);
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||['cross-site','same-site'].includes(request.headers.get('sec-fetch-site'))))return respond('Submit from the CRM.',403);
 const db=env.EDITING_DB;
 try{
 const t=await db.prepare('SELECT t.*,j.status job_status FROM tasks t JOIN jobs j ON j.id=t.job_id WHERE t.id=?').bind(id).first();if(!t)return respond('Task not found',404);
 if(!['open','in_progress'].includes(t.job_status)||await db.prepare('SELECT 1 FROM invoice_lines WHERE task_id=? AND active=1').bind(id).first())return respond('This task is closed or reserved by an invoice.',409);
 if(t.service_pack_id)return respond('This task consumes an existing pack. Use a separate task to sell products or a new SPack.',409);
 const source=await env.XERO_DB.prepare('SELECT * FROM catalogue_selection WHERE id=1').first(),items=source?(await db.prepare('SELECT * FROM xero_items WHERE tenant_id=? AND active=1 AND price_4 IS NOT NULL ORDER BY code').bind(source.tenant_id).all()).results:[];
 const rows=(await db.prepare('SELECT * FROM task_items WHERE task_id=? ORDER BY created_at,id').bind(id).all()).results;
 if(request.method==='POST'){
 let v;try{v=await readForm(request,['action','item_id','quantity','discount','line_id'])}catch(e){return respond(e.message,400)}
 if(v.id!==id||v.version!==String(t.version))return respond('Task changed. Reload before saving.',409);
 const now=new Date().toISOString();
 if(v.action==='remove'){
 if(!rows.some(r=>r.id===v.line_id))return respond('Item not found',404);
 const removed=await db.batch([db.prepare('UPDATE tasks SET changed_by=?,updated_at=? WHERE id=? AND version=?').bind(actor,now,id,t.version),db.prepare('DELETE FROM task_items WHERE id=? AND task_id=? AND EXISTS(SELECT 1 FROM tasks WHERE id=? AND version=?) RETURNING id').bind(v.line_id,id,id,t.version)]);
 if(!removed[1].results?.length)return respond('Task changed. Reload before removing an item.',409);
 }else if(v.action==='add'){
 const item=items.find(i=>i.item_id===v.item_id);if(!item)return respond('Choose a current product.',400);
 let q,d;try{q=scaled(v.quantity,4);d=scaled(v.discount,2)}catch{return respond('Enter a valid quantity and discount percentage.',400)}
 if(q<1||q>100000000||d>10000)return respond('Quantity must be positive and discount must be 0–100%.',400);
 const result=await db.prepare('INSERT INTO task_items(id,task_id,tenant_id,item_id,code,name,quantity_4,price_4,discount_bps,amount_cents,is_pack,changed_by,created_at) SELECT ?,id,?,?,?,?,?,?,?,?,?,?,? FROM tasks WHERE id=? AND version=? RETURNING id').bind(crypto.randomUUID(),item.tenant_id,item.item_id,item.code,item.name,q,item.price_4,d,itemAmount(q,item.price_4,d),item.is_pack,actor,now,id,t.version).all();if(!result.results.length)return respond('Task changed. Reload.',409);
 }else return respond('Invalid action',400);
 return respond('',303,'text/plain',{Location:url.pathname});
 }
 return respond(page('Task products and discounts',`<p>${esc(t.title)}</p><p>Product quantities replace hourly charges on this task. Time can still be recorded, but is not billed again. SPack is a new pack sale; it does not consume an existing pack or automatically create an hours allowance.</p><a href="/sandbox/items">Load or refresh Xero products</a><form method="post"><input type="hidden" name="id" value="${id}"><input type="hidden" name="version" value="${t.version}"><input type="hidden" name="action" value="add"><input type="hidden" name="line_id" value=""><label>Product<select name="item_id" aria-label="Product">${items.map(i=>`<option value="${i.item_id}">${esc(i.code)} — ${esc(i.name)}${i.is_pack?' (Service pack)':''} · $${(i.price_4/10000).toFixed(4)}</option>`).join('')}</select></label><label>Quantity<input name="quantity" type="number" min="0.0001" max="10000" step="0.0001" value="1" required></label><label>Discount (%)<input name="discount" type="number" min="0" max="100" step="0.01" value="0" required></label><button>Add product</button></form><ul>${rows.map(r=>`<li>${esc(r.code)} — ${esc(r.name)}<span>${r.quantity_4/10000} × $${(r.price_4/10000).toFixed(4)} less ${r.discount_bps/100}% = $${(r.amount_cents/100).toFixed(2)}</span><form method="post"><input type="hidden" name="id" value="${id}"><input type="hidden" name="version" value="${t.version}"><input type="hidden" name="action" value="remove"><input type="hidden" name="line_id" value="${r.id}"><input type="hidden" name="item_id" value=""><input type="hidden" name="quantity" value=""><input type="hidden" name="discount" value=""><button>Remove ${esc(r.code)}</button></form></li>`).join('')}</ul><p>To change quantity or discount, remove and re-add the item before invoicing. Prices are saved when added.</p><a href="/sandbox/tasks/${id}/edit">Back to task</a>`),200,'text/html');
 }catch{return respond('Could not update products. The task may be invoiced or changed. Reload before retrying.',409)}
}
