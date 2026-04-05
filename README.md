# Bloomwood Site

Astro + MDX + Tailwind site for Bloomwood Solutions.
## Bloomwood Media Blog
To update the blog, use files located in [src > content > blog > media](https://github.com/bloomsp/bloomwood-site/tree/main/src/content/blog/media)

## Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Deployment (Cloudflare Workers)

## Contact form environment variables

Set the following Cloudflare secrets / environment variables for the contact form:

- `MAILERSEND_API_TOKEN`
- `MAIL_FROM` (optional, defaults to `help@bloomwood.com.au`)
- `MAIL_TO` (optional, defaults to `help@bloomwood.com.au`)
- `TURNSTILE_SECRET_KEY` (required for Cloudflare Turnstile server-side validation)

The Turnstile site key is rendered in the contact form markup.


This project now deploys as a **Cloudflare Worker** using Wrangler.

Install dependencies and deploy with:

```bash
npm install
npm run deploy
```

Useful local commands:

```bash
npm run cf:check
npm run cf:dev
```

### KV binding (required)

Astro sessions are configured to use a Cloudflare KV binding named `SESSION` (see `astro.config.mjs`).

The root [wrangler.jsonc](./wrangler.jsonc) stores bindings and project metadata used during the Astro build. After `npm run build`, Astro generates the deployable Worker config at `dist/server/wrangler.json`.

The deployment expects:

- **Variable name:** `SESSION`
- **KV namespace id:** `20fb0ad2a0a94ae3bb99d3b300d3b53e`

The Worker also expects an Images binding named `IMAGES`.

Set application secrets before deploying:

```bash
npx wrangler secret put MAILERSEND_API_TOKEN
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put MAIL_FROM
npx wrangler secret put MAIL_TO
```

If you prefer dashboard-managed plain-text vars, you can add them to the Worker environment in Cloudflare, but secrets should stay out of git.

### Notes

- `npm run build` outputs static assets into `dist/client` and the Worker entry/config into `dist/server`.
- `npm run deploy` publishes the generated Worker config from `dist/server/wrangler.json`, which keeps the Worker and static assets in sync and avoids the stale HTML / missing `_astro` chunk problems seen with the old Pages setup.
- [.pages.yml](./.pages.yml) is kept because you are using Pages CMS for content editing, even though site deployment now runs through Workers.

## Dependabot / security advisories

You may see Dependabot alerts related to `wrangler`, `miniflare`, and `undici`. In this project, those packages are pulled in indirectly via `@astrojs/cloudflare` for build tooling.

Because deployment now uses **Wrangler / Cloudflare Workers**, these dependencies are part of the actual deploy toolchain.

- Keep `astro`, `@astrojs/cloudflare`, and `wrangler` updated together when making platform upgrades.
