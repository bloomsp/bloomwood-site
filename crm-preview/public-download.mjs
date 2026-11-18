export const publicOrigin='https://files-preview.bloomwood.com.au';
export const tokenHash=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reply=(body,status,type='text/plain',extra={})=>new Response(body,{status,headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",...extra}});
export async function publicDownload(request,env){
 const url=new URL(request.url),m=url.pathname.match(/^\/d\/([0-9a-f]{64})(\/download)?$/);
 if(url.origin!==publicOrigin||!m)return reply('Not found',404);
 if(request.method!=='GET')return reply('Method not allowed',405,undefined,{Allow:'GET'});
 try{
 const hash=await tokenHash(m[1]),now=new Date().toISOString();
 const d=await env.EDITING_DB.prepare("SELECT id,filename,object_key,expires_at FROM deliveries WHERE token_hash=? AND status='ready' AND expires_at>? AND public_downloads<10").bind(hash,now).first();
 if(!d)return reply('This link is invalid, expired, revoked or has reached its download limit.',404);
 if(!m[2])return reply(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bloomwood test file</title><style>body{font:18px/1.6 system-ui;max-width:40rem;margin:3rem auto;padding:1rem;overflow-wrap:anywhere}a{color:#245c3d}</style></head><body><h1>Bloomwood test file</h1><p>${esc(d.filename)}</p><p>This is a fictional test delivery. Link expires ${esc(d.expires_at)}. Up to ten downloads are allowed.</p><a href="${url.pathname}/download">Download file</a></body></html>`,200,'text/html');
 const object=await env.EDITING_FILES.get(d.object_key);if(!object)return reply('File unavailable',404);
 const claimed=await env.EDITING_DB.prepare("UPDATE deliveries SET public_downloads=public_downloads+1,version=version+1,changed_by='client-link',updated_at=? WHERE id=? AND token_hash=? AND status='ready' AND expires_at>? AND public_downloads<10 RETURNING id").bind(new Date().toISOString(),d.id,hash,new Date().toISOString()).all();
 if(claimed.results.length!==1)return reply('This link is no longer available.',404);
 return reply(object.body,200,'application/octet-stream',{'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(d.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))});
 }catch{return reply('Download unavailable. Please try again later.',503)}
}
export default {fetch:publicDownload};
