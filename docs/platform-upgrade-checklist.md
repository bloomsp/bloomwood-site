# Platform Upgrade Checklist

This checklist is the controlled path for moving the site from the current stable Astro 6 platform to the next supported Astro major release.

## Current Baseline

- App builds and deploys on the Astro 6 / Cloudflare adapter stable line.
- CRM magic-link login is currently working again after Supabase project recovery.
- Remaining audit noise is concentrated in the Astro, Vite, Wrangler, and Cloudflare toolchain.
- As of 2026-06-19, Astro 7 is not yet stable, so the major platform upgrade should not start until stable releases exist for both Astro and the Cloudflare adapter.

## Phase 1: Stable-Line Baseline

- [x] Keep Astro on the latest stable 6.x patch release.
- [x] Confirm `npm run build` passes.
- [x] Confirm `npm run cf:check` passes when run on its own.
- [x] Confirm `npm run test:crm` passes.
- [ ] Confirm CRM magic-link login still works.
- [ ] Confirm protected CRM routes still redirect correctly when signed out.
- [ ] Confirm secure download links still resolve correctly.
- [x] Record any remaining `npm audit` findings that are platform-only rather than application code issues.

Current note: after the stable-line patch bump to `astro 6.4.8`, `npm install` still reports `11 vulnerabilities (5 low, 1 moderate, 5 high)`. Based on the earlier audit review, the unresolved items are concentrated in the Astro, Vite, Wrangler, Miniflare, and Cloudflare toolchain rather than app-specific code paths.

## Phase 2: Upgrade Readiness

### `astro.config.mjs`

- [ ] Re-check `@astrojs/cloudflare` compatibility notes for the target Astro major.
- [ ] Re-check `sessionDrivers.cloudflareKVBinding()` support and any session config changes.
- [ ] Re-check the Vite plugin wiring for Tailwind.
- [ ] Re-check whether `security.checkOrigin = false` is still needed and still valid.
- [ ] Re-check sitemap route exclusions in the Cloudflare adapter config.

### `src/middleware.ts`

- [ ] Re-check `cloudflare:workers` runtime import compatibility.
- [ ] Re-check `context.locals` typing and request lifecycle assumptions.
- [ ] Re-check Supabase SSR client creation and cookie handling.
- [ ] Re-test `/crm` auth gating and redirect behavior.

### Supporting Files

- [ ] Re-check `src/env.d.ts` against any new adapter/runtime typing changes.
- [ ] Re-check `src/lib/supabase/server.ts` for any Astro or adapter API changes.
- [ ] Re-check `src/pages/crm/auth/callback.astro` for request/redirect API changes.
- [ ] Confirm `src/content.config.ts` remains compatible without changes.

## Phase 3: Upgrade Trigger

Only begin the major platform migration when both are true:

- [ ] Astro next major is stable.
- [ ] `@astrojs/cloudflare` has a stable release compatible with that Astro major.

If either item is still prerelease-only, defer the migration.

## Phase 4: Migration Execution

- [ ] Create a dedicated upgrade branch.
- [ ] Upgrade `astro`, `@astrojs/cloudflare`, other `@astrojs/*` packages, and the supported `vite` line together.
- [ ] Run install and refresh the lockfile.
- [ ] Fix adapter/config issues first.
- [ ] Fix middleware/runtime typing second.
- [ ] Re-run all verification commands.
- [ ] Smoke-test Cloudflare preview or dry-run deploy output.

## Verification Set

Run these after each upgrade step:

```bash
npm run test:crm
npm run build
npm run cf:check
```

Manual checks:

- CRM login request flow
- CRM callback completion
- CRM authenticated navigation
- Contact form submission
- Secure download link redemption

## Exit Criteria

- All automated checks pass.
- Critical manual flows pass.
- No new auth, session, or Cloudflare runtime regressions are introduced.
- Remaining advisories, if any, are understood and documented as upstream platform issues rather than unresolved app defects.
