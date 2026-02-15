export async function GET({ site }: { site: URL }) {
  // Provide a conventional /sitemap.xml endpoint that points at the generated sitemap index.
  // This stays correct on Cloudflare Pages preview domains because `site` is derived from Astro.site.
  const loc = new URL('/sitemap-index.xml', site).toString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <sitemap><loc>${loc}</loc></sitemap>\n` +
    `</sitemapindex>\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
}
