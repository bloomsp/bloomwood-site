import { chromium } from 'playwright';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BASE_URL = 'https://bloomwood.com.au';
const MAX_PAGES = 200;
const baseOrigin = new URL(BASE_URL);

function isAllowedPageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;

    const isBaseHost = url.hostname === baseOrigin.hostname;
    const isSubdomain = url.hostname.endsWith(`.${baseOrigin.hostname}`);

    return (isBaseHost || isSubdomain) && url.origin.endsWith(baseOrigin.hostname);
  } catch {
    return false;
  }
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
}

async function getSitemapUrls() {
  let sitemapUrls = [];

  try {
    const sitemapIndex = await fetchText(`${BASE_URL}/sitemap-index.xml`);
    sitemapUrls = extractLocs(sitemapIndex);
  } catch {
    sitemapUrls = [`${BASE_URL}/sitemap.xml`];
  }
  const pageUrls = new Set();

  if (sitemapUrls.length > 0) {
    for (const sitemapUrl of sitemapUrls) {
      try {
        const xml = await fetchText(sitemapUrl);
        for (const url of extractLocs(xml)) {
          if (isAllowedPageUrl(url)) pageUrls.add(url);
        }
      } catch {
        // Ignore missing sitemap endpoints and fall back to built routes below.
      }
    }
  }

  if (pageUrls.size === 0) {
    const distRoot = join(process.cwd(), 'dist/client');
    const stack = [distRoot];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;

      for (const entry of readdirSync(current)) {
        const fullPath = join(current, entry);
        const stats = statSync(fullPath);

        if (stats.isDirectory()) {
          stack.push(fullPath);
          continue;
        }

        if (entry !== 'index.html') continue;

        const routePath = relative(distRoot, current)
          .split('/')
          .filter(Boolean)
          .join('/');
        const normalizedRoute = routePath ? `/${routePath}/` : '/';
        pageUrls.add(`${BASE_URL}${normalizedRoute}`);
      }
    }
  }

  return [...pageUrls].sort().slice(0, MAX_PAGES);
}

function simplifyMessage(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeIssue(entry) {
  return {
    type: entry.type,
    text: simplifyMessage(entry.text),
    location: entry.location ?? null,
    url: entry.url ?? null,
  };
}

function dedupeIssues(issues) {
  const seen = new Set();
  return issues.filter((issue) => {
    const key = JSON.stringify(issue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const urls = await getSitemapUrls();
const summary = [];

for (const url of urls) {
  const page = await context.newPage();
  const issues = [];
  let status = null;
  let csp = null;
  let cspReportOnly = null;

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      issues.push(
        normalizeIssue({
          type: `console:${msg.type()}`,
          text: msg.text(),
          location: msg.location(),
        }),
      );
    }
  });

  page.on('pageerror', (error) => {
    issues.push(
      normalizeIssue({
        type: 'pageerror',
        text: error.message,
      }),
    );
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    issues.push(
      normalizeIssue({
        type: 'requestfailed',
        text: `${request.resourceType()} ${failure?.errorText ?? 'failed'}`,
        url: request.url(),
      }),
    );
  });

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    status = response?.status() ?? null;
    csp = response?.headers()['content-security-policy'] ?? null;
    cspReportOnly = response?.headers()['content-security-policy-report-only'] ?? null;
    await page.waitForTimeout(3000);

    if (url.includes('/solutions/bookings/')) {
      const summaryEl = page.locator('summary').first();
      if (await summaryEl.count()) {
        await summaryEl.click().catch(() => {});
      }
      const accordionTrigger = page.getByRole('button', { name: /faq|services|service area|make a booking/i }).first();
      if (await accordionTrigger.count()) {
        await accordionTrigger.click().catch(() => {});
      }
      await page.waitForTimeout(500);
    }
  } catch (error) {
    issues.push(
      normalizeIssue({
        type: 'navigation',
        text: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  summary.push({
    url,
    status,
    csp,
    cspReportOnly,
    issues: dedupeIssues(issues),
  });

  await page.close();
}

await browser.close();

const pagesWithIssues = summary.filter((entry) => entry.issues.length > 0);

console.log(
  JSON.stringify(
    {
      scanned: summary.length,
      pagesWithIssues: pagesWithIssues.length,
      pages: pagesWithIssues,
    },
    null,
    2,
  ),
);
