import { createRemoteJWKSet, jwtVerify } from 'jose';

const hostname = 'crm-preview.bloomwood.com.au';
let keyCache;
function accessKeys(issuer) {
  if (keyCache?.issuer !== issuer) {
    keyCache = { issuer, keys: createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer)) };
  }
  return keyCache.keys;
}

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const respond = (body, status, type = 'text/plain', extra = {}) => new Response(body, {
  status, headers: { 'Content-Type': type + '; charset=utf-8', 'Cache-Control':'private, no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'X-Robots-Tag':'noindex, nofollow', ...extra }
});

function directory(rows) {
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Client directory | Bloomwood CRM preview</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f5f7f3;color:#213729;font:1rem/1.55 system-ui,sans-serif}main{max-width:48rem;margin:auto;padding:clamp(1rem,5vw,3rem)}header{border-bottom:2px solid #44654f}small{font-weight:650;color:#46664e}h1{line-height:1.1}ul{list-style:none;padding:0}li{background:white;padding:1rem;margin:.6rem 0;border:1px solid #d6dfd7;border-radius:.5rem}li span{display:block}</style></head>
<body><main><header><small>Bloomwood · Staff preview</small><h1>Client directory</h1><p>Sample records only. This directory is read-only.</p></header><ul>${rows.map(r => `<li><strong>${escape(r.display_name)}</strong><span>${escape(r.service)} · ${escape(r.locality)}</span></li>`).join('')}</ul></main></body></html>`;
}

export function createHandler(keysFor = accessKeys) {
  return async (request, env) => {
    const url = new URL(request.url);
    if (url.hostname !== hostname) return respond('Not found', 404);
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token) return respond('Staff sign-in required', 401);
    const { ACCESS_ISSUER: issuer, ACCESS_AUD: audience, STAFF_EMAIL: staff } = env;
    if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer ?? '') || !audience || !staff?.trim()) return respond('Staff access is not configured', 503);
    try {
      const { payload } = await jwtVerify(token, keysFor(issuer), {
        issuer, audience, algorithms:['RS256'], requiredClaims:['exp','sub','email']
      });
      if (typeof payload.email !== 'string' || payload.email.toLowerCase() !== staff.trim().toLowerCase()) return respond('Access denied', 403);
    } catch { return respond('Invalid staff session', 401); }
    if (request.method !== 'GET') return respond('Read-only directory', 405, 'text/plain', { Allow:'GET' });
    if (!['/', '/api/clients'].includes(url.pathname)) return respond('Not found', 404);
    try {
      const { results } = await env.PREVIEW_DB.prepare('SELECT id, display_name, service, locality FROM sample_clients ORDER BY display_name').all();
      return url.pathname === '/' ? respond(directory(results), 200, 'text/html') : respond(JSON.stringify(results), 200, 'application/json');
    } catch { return respond('Directory unavailable', 503); }
  };
}
export default { fetch:createHandler() };
