import {page,esc,readForm} from './client-editor.mjs';
import {tokenHash} from './public-download.mjs';
export const callback='https://crm-preview.bloomwood.com.au/sandbox/xero/callback';
const network=(env,...args)=>(env.XERO_FETCH||fetch)(...args);
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function key(env){return crypto.subtle.importKey('raw',unb64(env.XERO_TOKEN_KEY),'AES-GCM',false,['encrypt','decrypt'])}
export async function seal(env,data){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),new TextEncoder().encode(JSON.stringify(data))))}
async function unseal(env,data){const [iv,body]=data.split('.');return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},await key(env),unb64(body))))}
async function tokens(env,body){
 const r=await network(env,'https://identity.xero.com/connect/token',{method:'POST',headers:{Authorization:'Basic '+btoa(env.XERO_CLIENT_ID+':'+env.XERO_CLIENT_SECRET),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Xero authorisation failed. Reconnect Xero.');const t=await r.json();if(!t.access_token||!t.refresh_token||!Number.isFinite(t.expires_in))throw Error('Invalid token response');return t;
}
export async function xeroSession(env){
 if(!env.XERO_DB||!env.XERO_CLIENT_ID||!env.XERO_CLIENT_SECRET||!env.XERO_TOKEN_KEY)throw Error('Xero setup is incomplete.');
 const db=env.XERO_DB,row=await db.prepare('SELECT * FROM connection WHERE id=1').first();if(!row)throw Error('Connect Xero first.');
 let t=await unseal(env,row.encrypted_tokens);
 if(row.expires_at<Date.now()+60000){
 const lock=crypto.randomUUID(),claimed=await db.prepare('UPDATE connection SET refresh_lock=?,lock_until=? WHERE id=1 AND lock_until<? RETURNING id').bind(lock,Date.now()+60000,Date.now()).all();
 if(!claimed.results.length)throw Error('Xero connection is refreshing. Try again shortly.');
 try{
 const fresh=await db.prepare('SELECT * FROM connection WHERE id=1').first();t=await unseal(env,fresh.encrypted_tokens);
 if(fresh.expires_at<Date.now()+60000){t=await tokens(env,{grant_type:'refresh_token',refresh_token:t.refresh_token});await db.prepare('UPDATE connection SET encrypted_tokens=?,expires_at=? WHERE id=1 AND refresh_lock=?').bind(await seal(env,t),Date.now()+t.expires_in*1000,lock).run();}
 }finally{await db.prepare('UPDATE connection SET lock_until=0,refresh_lock=NULL WHERE id=1 AND refresh_lock=?').bind(lock).run()}
 }
 return {tenant:row.tenant_id,name:row.tenant_name,token:t.access_token};
}
export async function xeroApi(env,session,path,options={}){
 const r=await network(env,'https://api.xero.com/api.xro/2.0/'+path,{...options,headers:{Authorization:'Bearer '+session.token,'Xero-tenant-id':session.tenant,Accept:'application/json','Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Xero request failed ('+r.status+').');return r.json();
}
export async function requireDemo(env,session){const data=await xeroApi(env,session,'Organisation');if(data.Organisations?.length!==1||data.Organisations[0].IsDemoCompany!==true||data.Organisations[0].BaseCurrency!=='AUD')throw Error('Only the Australian Xero Demo Company is enabled for this preview.');return data.Organisations[0]}
export async function xeroConnection(request,env,actor,respond){
 const url=new URL(request.url),path=url.pathname;if(!['/sandbox/xero','/sandbox/xero/connect','/sandbox/xero/callback'].includes(path))return respond('Not found',404);
 if(path==='/sandbox/xero/connect'&&request.method!=='POST'||path!=='/sandbox/xero/connect'&&request.method!=='GET')return respond('Method not allowed',405);
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||['cross-site','same-site'].includes(request.headers.get('sec-fetch-site'))))return respond('Submit from the CRM.',403);
 try{
 if(!env.XERO_DB||!env.XERO_CLIENT_ID||!env.XERO_CLIENT_SECRET||!env.XERO_TOKEN_KEY)return respond(page('Xero setup',`<p>Demo Company integration is prepared. Configure XERO_CLIENT_ID and XERO_CLIENT_SECRET as Worker secrets to connect. Never paste the secret into chat.</p><p>Authorised redirect URI:</p><p style="overflow-wrap:anywhere">${callback}</p>`),200,'text/html');
 if(path==='/sandbox/xero'){const row=await env.XERO_DB.prepare('SELECT tenant_name FROM connection WHERE id=1').first();return respond(page('Xero Demo Company',`<p>${row?'Connected: '+esc(row.tenant_name):'Not connected'}</p><p>Invoice creation is restricted to Australian Demo Company. Also authorise live Bloomwood to import its product catalogue read-only.</p><form method="post" action="/sandbox/xero/connect"><input type="hidden" name="id" value="connect"><input type="hidden" name="version" value=""><button>Connect or update Xero access</button></form>`),200,'text/html',{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://login.xero.com"})}
 if(path==='/sandbox/xero/connect'){
 await readForm(request,[]);const state=crypto.randomUUID()+crypto.randomUUID();await env.XERO_DB.prepare('INSERT INTO oauth_states(hash,actor,expires_at) VALUES(?,?,?)').bind(await tokenHash(state),actor,Date.now()+600000).run();
 const auth=new URL('https://login.xero.com/identity/connect/authorize');auth.search=new URLSearchParams({response_type:'code',client_id:env.XERO_CLIENT_ID,redirect_uri:callback,scope:'offline_access accounting.invoices accounting.contacts.read accounting.settings.read',state}).toString();return respond('',303,'text/plain',{Location:auth.href,'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://login.xero.com"});
 }
 const state=url.searchParams.get('state')||'',code=url.searchParams.get('code');if(!state||!code||state.length>200||code.length>3000)return respond('Xero connection cancelled or invalid. Start again.',400);
 const consumed=await env.XERO_DB.prepare('DELETE FROM oauth_states WHERE hash=? AND actor=? AND expires_at>? RETURNING hash').bind(await tokenHash(state),actor,Date.now()).all();if(!consumed.results.length)return respond('Connection request expired or belongs to a different staff session.',403);
 const t=await tokens(env,{grant_type:'authorization_code',code,redirect_uri:callback});
 const r=await network(env,'https://api.xero.com/connections',{headers:{Authorization:'Bearer '+t.access_token},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Could not read Xero connections.');
 const connections=await r.json();const demos=[];for(const c of connections){const session={tenant:c.tenantId,token:t.access_token};try{const org=await requireDemo(env,session);demos.push({id:c.tenantId,name:org.Name})}catch{}}
 if(demos.length!==1)throw Error('Authorise exactly one Australian Demo Company. No live organisation can be selected.');
 const d=demos[0];await env.XERO_DB.prepare('INSERT INTO connection(id,encrypted_tokens,expires_at,tenant_id,tenant_name) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET encrypted_tokens=excluded.encrypted_tokens,expires_at=excluded.expires_at,tenant_id=excluded.tenant_id,tenant_name=excluded.tenant_name,refresh_lock=NULL,lock_until=0').bind(await seal(env,t),Date.now()+t.expires_in*1000,d.id,d.name).run();
 return respond('',303,'text/plain',{Location:'/sandbox/xero','Referrer-Policy':'no-referrer'});
 }catch{return respond(page('Xero connection unavailable','<p>Check the app credentials, redirect URI and Australian Demo Company authorisation, then reconnect. No live organisation has been enabled.</p><a href="/sandbox/xero">Xero setup</a>'),503,'text/html')}
}
