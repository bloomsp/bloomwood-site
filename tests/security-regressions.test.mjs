import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { parse } from 'parse5';
import { serializeJsonForHtml } from '../src/lib/html-json.mjs';
import { getDownloadFile, sha256Hex } from '../src/lib/server/downloads.ts';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function scripts(node) {
  return (node.tagName === 'script' ? [node] : []).concat((node.childNodes ?? []).flatMap(scripts));
}

test('HTML parsing cannot break out of callback JSON, including mixed-case closing tags', () => {
  for (const next of ['/crm</script><script>alert(1)</script>', '/crm</ScRiPt><img src=x onerror=alert(1)>', '/crm<!--<script>', '/crm/clients?name=A&B']) {
    const config = { next, supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'public-key' };
    const nodes = scripts(parse(`<script type="application/json">${serializeJsonForHtml(config)}</script>`));
    assert.equal(nodes.length, 1);
    assert.deepEqual(JSON.parse(nodes[0].childNodes[0].value), config);
  }
  assert.equal(scripts(parse(`<script>${JSON.stringify({ next: '/crm</script><script>alert(1)</script>' })}</script>`)).length, 2);
  assert.match(source('src/pages/crm/auth/callback.astro'), /set:html=\{serializeJsonForHtml\(/);
  assert.match(source('src/components/Schema.astro'), /set:html=\{serializeJsonForHtml\(/);
});

test('all private layouts omit third-party loaders server-side', () => {
  const base = source('src/layouts/BaseLayout.astro');
  assert.match(base, /\{!privatePage && <script\s+id="cookieyes"/);
  assert.match(base, /\{!privatePage && <script is:inline[^>]+define:vars/);
  assert.match(source('src/layouts/CrmLayout.astro'), /<BaseLayout[^>]+privatePage>/);
  assert.match(source('src/layouts/PageLayout.astro'), /privatePage=\{privatePage\}/);
  for (const path of ['src/pages/solutions/download-admin.astro', 'src/pages/solutions/download/[token].astro']) {
    assert.match(source(path), /<PageLayout[^>]+privatePage>/);
  }
});

async function fixture({ max = 1, status = 'active', expires = '2099-01-01T00:00:00.000Z', objectExists = true, beforeGet } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(source('migrations/0001_client_downloads.sql'));
  db.prepare('INSERT INTO download_jobs (id,job_reference,client_name,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('job', 'ref', 'Client', expires, expires, expires);
  db.prepare('INSERT INTO download_files (id,job_id,r2_key,display_name,created_at) VALUES (?,?,?,?,?)').run('file', 'job', 'object', 'file.txt', expires);
  db.prepare('INSERT INTO download_tokens (id,job_id,token_hash,status,expires_at,max_downloads,created_at) VALUES (?,?,?,?,?,?,?)').run('token', 'job', await sha256Hex('secret'), status, expires, max, expires);
  const env = {
    CLIENT_DOWNLOADS_DB: {
      prepare(sql) {
        const statement = db.prepare(sql);
        return { bind(...args) { return {
          async first() { return statement.get(...args) ?? null; },
          async all() { return { success: true, results: statement.all(...args) }; },
          async run() { return { success: true, meta: statement.run(...args) }; },
        }; } };
      },
    },
    CLIENT_DOWNLOADS_BUCKET: {
      async get() {
        beforeGet?.(db);
        return objectExists ? { body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('contents')); controller.close(); } }) } : null;
      },
    },
  };
  return { db, env, count: () => db.prepare('SELECT download_count FROM download_tokens').get().download_count };
}

test('concurrent file requests cannot exceed the final allowance', async () => {
  const f = await fixture();
  try {
    const results = await Promise.all(Array.from({ length: 20 }, () => getDownloadFile(f.env, 'secret', 'file')));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(f.count(), 1);
    assert.equal(await new Response(results.find(Boolean).object.body).text(), 'contents');
  } finally { f.db.close(); }
});

test('unlimited downloads work; invalid, expired and revoked tokens do not consume quota', async () => {
  for (const options of [{ max: null }, { max: 0 }, { status: 'revoked' }, { expires: '2000-01-01T00:00:00.000Z' }]) {
    const f = await fixture(options);
    try {
      const result = await getDownloadFile(f.env, 'secret', 'file');
      assert.equal(Boolean(result), options.max === null);
      if (options.max === null) assert.ok(await getDownloadFile(f.env, 'secret', 'file'));
      assert.equal(await getDownloadFile(f.env, 'wrong', 'file'), null);
      assert.equal(await getDownloadFile(f.env, 'secret', 'wrong'), null);
      assert.equal(f.count(), options.max === null ? 2 : 0);
    } finally { f.db.close(); }
  }
});

test('revocation or expiry while fetching R2 is checked again at the atomic claim', async () => {
  for (const sql of ["UPDATE download_tokens SET status='revoked'", "UPDATE download_tokens SET expires_at='2000-01-01T00:00:00.000Z'"]) {
    const f = await fixture({ beforeGet: (db) => db.exec(sql) });
    try {
      assert.equal(await getDownloadFile(f.env, 'secret', 'file'), null);
      assert.equal(f.count(), 0);
    } finally { f.db.close(); }
  }
});

test('missing R2 object does not consume quota', async () => {
  const f = await fixture({ objectExists: false });
  try {
    await assert.rejects(getDownloadFile(f.env, 'secret', 'file'), /File missing in R2/);
    assert.equal(f.count(), 0);
  } finally { f.db.close(); }
});
