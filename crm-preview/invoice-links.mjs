import {esc} from './client-editor.mjs';
export async function taskInvoiceLinks(db,task){
 const {results}=await db.prepare('SELECT i.id,i.status,max(l.task_id=?) direct FROM invoice_lines l JOIN invoices i ON i.id=l.invoice_id WHERE l.active=1 AND (l.task_id=? OR l.service_pack_id=?) GROUP BY i.id,i.status ORDER BY direct DESC,i.created_at,i.id').bind(task.id,task.id,task.service_pack_id).all();
 return results.length?`<ul>${results.map(i=>`<li>${i.direct?'This task':'Shared service pack'}: <a href="/sandbox/invoices/${esc(i.id)}">Invoice ${esc(i.id)}</a><span>Status: ${esc(i.status)}</span></li>`).join('')}</ul>`:'';
}
