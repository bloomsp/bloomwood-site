# Bloomwood Site — Project Summary

_Last reviewed: 2026-05-21_

## Purpose

Bloomwood Site is the public web presence for Bloomwood, covering Bloomwood Solutions and Bloomwood Media content, plus a lightweight internal CRM area.

## Stack

- Astro 6
- MDX/Markdown content collections
- Tailwind CSS 4
- React components where needed
- shadcn/ui-style component primitives in `src/components/ui`
- Cloudflare Worker deployment via `@astrojs/cloudflare` and Wrangler
- Supabase-backed CRM/auth integration

## Main areas

- `src/content/pages/solutions` — Bloomwood Solutions marketing and service pages
- `src/content/pages/media` — Bloomwood Media pages
- `src/content/blog/media` — media blog posts
- `src/pages/crm` — CRM screens for clients, jobs, service packs, invoices, and login
- `src/pages/api` — contact form, CRM magic-link login, and download routes
- `src/lib/supabase` — Supabase client/server/admin helpers
- `src/lib/server/downloads.ts` — protected client download logic
- `public/` — static assets, images, PDFs, redirects, headers
- `migrations/` and `supabase/` — database/schema support files

## Deployment

Production builds with:

```bash
npm run build
npm run deploy
```

The deploy path uses the generated Worker config at `dist/server/wrangler.json`.

Cloudflare-side requirements include:

- Worker/KV session binding `SESSION`
- Images binding `IMAGES`
- MailerSend/Turnstile/contact-form secrets
- Supabase public URL and anon key variables

## Verification commands

```bash
npm run test:crm
npm run build
```

Last local verification on 2026-05-21:

- `npm run test:crm` passed 26/26
- `npm run build` passed
- Git status was clean before documentation changes

## Current notes

- Supabase project URL `https://woqyuqikeijvnmrhzfux.supabase.co` is reachable again after project reactivation; `/auth/v1/settings` returned `200 OK`.
- CRM login had previously failed while the Supabase hostname did not resolve, likely because the Supabase project was deactivated for inactivity.
- Live CRM smoke checks on 2026-05-21 confirmed `/crm` redirects unauthenticated users to `/crm/login?next=%2Fcrm`, `/crm/login` returns `200`, and `/api/crm/request-link` reaches Supabase. A request for `help@bloomwood.com.au` returned `Signups not allowed for otp`, which means that address is not currently an invited Supabase Auth user for CRM magic-link login.
- The project has moved from the original “Cloudflare Pages project” framing to a Worker-first deployment while retaining `.pages.yml` for Pages CMS/content editing.
