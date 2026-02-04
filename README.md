# Bloomwood Site

Astro + MDX + Tailwind site for Bloomwood Solutions.

## Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Deployment (Cloudflare Pages)

This project deploys via **Cloudflare Pages Git integration** (push to `main` → Pages builds and deploys).

### KV binding (required)

Astro sessions are configured to use a Cloudflare KV binding named `SESSION` (see `astro.config.mjs`).

In **Cloudflare Pages → Project → Settings → Bindings → KV namespaces**, add:

- **Variable name:** `SESSION`
- **KV namespace:** select the KV namespace you want to use for sessions

After saving, trigger a new deployment (push to `main` or click “Retry deployment”).

### Wrangler config files

This repo does **not** rely on running `wrangler` locally for deployment.

Cloudflare Pages may attempt to auto-detect Wrangler configuration during builds. If a `wrangler.json(c)` / `wrangler.toml` file is present, Pages may log warnings about Pages-specific properties.

If you are deploying via Git integration (recommended), you can keep Wrangler config files **out of the repo** (or renamed, e.g. `wrangler.jsonc.old`) and configure bindings in the Pages dashboard instead.

## Dependabot / security advisories

You may see Dependabot alerts related to `wrangler`, `miniflare`, and `undici`. In this project, those packages are pulled in indirectly via `@astrojs/cloudflare` for build tooling.

Because deployment uses **Cloudflare Pages Git integration** (not `wrangler pages deploy`), these advisories are generally **toolchain / build-time** concerns rather than production runtime issues.

- If you add CI steps that run `wrangler pages deploy`, reassess and update dependencies.
- Otherwise, wait for `@astrojs/cloudflare` to bump its dependency constraints so patched versions can be installed.
