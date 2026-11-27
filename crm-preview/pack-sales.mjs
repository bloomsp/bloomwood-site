import {page,esc,uuid,readForm} from './client-editor.mjs';
import {scaled} from './xero-items.mjs';
export async function packProduct(request,env,actor,respond){
 const url=new URL(request.url),id=url.pathname.split('/')[3];
 if(!uuid.test(id||''))return respond('Not found',404);
 if(!['GET','POST'].includes(request.method))return respond('Method not allowed',405);
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||['cross-site','same-site'].includes(request.headers.get('sec-fetch-site'))))return respond('Submit from the CRM.',403);
 try{
 const source=await env.XERO_DB.prepare('SELECT * FROM catalogue_selection WHERE id=1').first(),db=env.EDITING_DB;
 const item=source&&await db.prepare('SELECT * FROM xero_items WHERE tenant_id=? AND item_id=? AND is_pack=1').bind(source.tenant_id,id).first();
 if(!item)return respond('Service-pack product not found in the selected catalogue.',404);
 const current=await db.prepare('SELECT * FROM pack_products WHERE tenant_id=? AND item_id=?').bind(source.tenant_id,id).first();
 const services=(await db.prepare('SELECT id,name FROM service_types ORDER BY name').all()).results;
 if(request.method==='POST'){
 let v,minutes;try{v=await readForm(request,['tenant_id','service_type_id','hours']);minutes=scaled(v.hours,2)*60/100;if(v.id!==id||v.tenant_id!==source.tenant_id||v.version!==String(current?.version||0)||!services.some(s=>s.id===v.service_type_id)||!Number.isInteger(minutes)||minutes<1||minutes>1000000)throw Error();}catch{return respond('Reload and choose a service and hours equivalent to whole minutes.',400)}
 const now=new Date().toISOString();
 const r=await db.prepare('INSERT INTO pack_products(tenant_id,item_id,service_type_id,minutes_per_unit,changed_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(tenant_id,item_id) DO UPDATE SET service_type_id=excluded.service_type_id,minutes_per_unit=excluded.minutes_per_unit,version=pack_products.version+1,changed_by=excluded.changed_by,updated_at=excluded.updated_at WHERE pack_products.version=? RETURNING item_id').bind(source.tenant_id,id,v.service_type_id,minutes,actor,now,Number(v.version)).all();
 if(!r.results.length)return respond('Settings changed. Reload before saving.',409);
 return respond('',303,'text/plain',{Location:url.pathname});
 }
 return respond(page('Service-pack product settings',`<p>${esc(item.code)} — ${esc(item.name)}</p><p>Set the allowance for one product. Quantity multiplies the hours; discounts change the price only. Settings are saved with the invoice when it is first sent to Xero.</p><form method="post"><input type="hidden" name="id" value="${id}"><input type="hidden" name="tenant_id" value="${source.tenant_id}"><input type="hidden" name="version" value="${current?.version||0}"><label>Service<select name="service_type_id" required>${services.map(s=>`<option value="${s.id}" ${s.id===current?.service_type_id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Hours per product<input name="hours" type="number" min="0.05" max="16666.65" step="0.05" value="${current?current.minutes_per_unit/60:(item.code.match(/spack(\d+(?:\.\d+)?)/i)?.[1]||'')}" required></label><button>Save pack settings</button></form><p>${current?'Configured: '+current.minutes_per_unit+' minutes per product.':'Not configured.'}</p><a href="/sandbox/services">Manage services</a> · <a href="/sandbox/items">Back to products</a>`),200,'text/html');
 }catch{return respond('Could not save pack settings. Please retry.',503)}
}
export async function packSetupProblems(db,id){
 const rows=(await db.prepare('SELECT p.*,m.minutes_per_unit FROM all_invoice_products p LEFT JOIN pack_products m ON m.tenant_id=p.tenant_id AND m.item_id=p.item_id WHERE p.invoice_id=? AND p.is_pack=1').bind(id).all()).results;
 return rows.filter(p=>!p.minutes_per_unit||p.quantity_4*p.minutes_per_unit%10000!==0||p.quantity_4*p.minutes_per_unit/10000>1000000).map(p=>p.code);
}
function sameLines(expected,actual){
 if(!Array.isArray(actual)||expected.length!==actual.length)return false;
 const normalize=l=>JSON.stringify([l.Description,Number(l.Quantity),Number(l.UnitAmount),Number(l.DiscountRate||0),l.ItemCode||'']);
 return expected.map(normalize).sort().join('\n')===actual.map(normalize).sort().join('\n');
}
export async function packActivation(db,id,remote,original,actor){
 const grants=(await db.prepare('SELECT * FROM invoice_pack_grants WHERE invoice_id=?').bind(id).all()).results;
 const hasPacks=await db.prepare('SELECT 1 FROM all_invoice_products WHERE invoice_id=? AND is_pack=1 LIMIT 1').bind(id).first();
 const activated=await db.prepare('SELECT 1 FROM service_packs WHERE invoice_source IN (SELECT source_key FROM invoice_pack_grants WHERE invoice_id=?) LIMIT 1').bind(id).first();
 if(!hasPacks)return {review:null,statements:[]};
 if(!grants.length)return {review:'This older invoice has no saved pack allowance. Review and create its allowance manually.',statements:[]};
 if(remote.Status!=='PAID')return {review:activated?'Payment status changed after activation. Review the allowance manually; it has not been removed.':null,statements:[]};
 if(remote.AmountDue!==0||!sameLines(original.LineItems,remote.LineItems))return {review:'Pack activation needs review: payment balance or invoice products differ from the saved sale.',statements:[]};
 const now=new Date().toISOString();
 return {review:null,statements:grants.map(g=>db.prepare('INSERT INTO service_packs(id,client_id,service_type_id,name,purchased_minutes,changed_by,updated_at,invoice_source) SELECT ?,client_id,?,?,?,?,?,? FROM invoices WHERE id=? ON CONFLICT(invoice_source) WHERE invoice_source IS NOT NULL DO NOTHING').bind(crypto.randomUUID(),g.service_type_id,g.name,g.minutes,actor,now,g.source_key,id))};
}
