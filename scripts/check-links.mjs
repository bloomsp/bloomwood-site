import { readFile, readdir, stat, access } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve(process.argv[2] ?? 'dist');

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

function stripHashAndQuery(href) {
  const i = href.search(/[?#]/);
  return i === -1 ? href : href.slice(0, i);
}

function isExternal(href) {
  return /^(https?:)?\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('sms:') || href.startsWith('javascript:');
}

function normalizeInternalHref(href) {
  // Only for absolute-site-path hrefs: /a/b or /a/b/
  const clean = stripHashAndQuery(href);
  if (!clean.startsWith('/')) return null;
  return clean;
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function extractHrefs(html) {
  const hrefs = [];
  // crude but effective for static HTML
  const re = /\shref\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[2] ?? m[3] ?? '';
    if (href) hrefs.push(href.trim());
  }
  return hrefs;
}

const files = (await walk(distDir)).filter((f) => f.endsWith('.html'));

const internalRefs = new Map(); // href -> [fromFiles]
const externalRefs = new Map();

for (const f of files) {
  const html = await readFile(f, 'utf8');
  const hrefs = extractHrefs(html);
  for (const href of hrefs) {
    if (!href || href === '#') continue;
    if (isExternal(href)) {
      externalRefs.set(href, (externalRefs.get(href) ?? []).concat([f]));
      continue;
    }

    const norm = normalizeInternalHref(href);
    if (!norm) continue; // ignore relative links like "../" inside dist (should be rare)

    internalRefs.set(norm, (internalRefs.get(norm) ?? []).concat([f]));
  }
}

const missing = [];
for (const [href, from] of internalRefs.entries()) {
  // resolve to dist file
  let target;
  if (href.endsWith('/')) {
    target = path.join(distDir, href, 'index.html');
  } else {
    // could be a file like /sitemap.xml
    target = path.join(distDir, href);
    const asHtml = path.join(distDir, href, 'index.html');
    if (!(await exists(target)) && (await exists(asHtml))) target = asHtml;
  }

  if (!(await exists(target))) {
    missing.push({ href, from: Array.from(new Set(from)).slice(0, 5), count: from.length });
  }
}

// flag obviously non-crawlable patterns
const badExternal = [];
for (const href of externalRefs.keys()) {
  if (href.startsWith('http://localhost')) badExternal.push(href);
}

missing.sort((a, b) => a.href.localeCompare(b.href));

console.log(`Checked ${files.length} HTML files under ${distDir}`);
console.log(`Internal unique hrefs: ${internalRefs.size}`);
console.log(`External unique hrefs: ${externalRefs.size}`);

if (badExternal.length) {
  console.log(`\nExternal links pointing to localhost (should be fixed):`);
  for (const h of badExternal) console.log(`- ${h}`);
}

if (!missing.length) {
  console.log(`\n✅ No missing internal targets found.`);
} else {
  console.log(`\n❌ Missing internal targets (${missing.length}):`);
  for (const m of missing.slice(0, 50)) {
    console.log(`- ${m.href} (referenced ${m.count}x; e.g. from ${m.from.map((p) => path.relative(distDir, p)).join(', ')})`);
  }
  if (missing.length > 50) console.log(`...and ${missing.length - 50} more`);
  process.exitCode = 1;
}
