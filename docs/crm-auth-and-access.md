# Bloomwood CRM Auth and Access Pattern

## Recommendation

Protect `/crm/*` with **Supabase Auth** and treat it as a private internal application namespace.

This should be separate from:
- the public Bloomwood marketing site
- the temporary `/solutions/download-admin` helper gate

## Route strategy

### Public routes
- `/`
- `/solutions/*`
- `/media/*`

### Internal CRM routes
- `/crm`
- `/crm/*`

The CRM should require authentication for every route under `/crm`.

## Recommended auth model

### v1 auth
Use **Supabase Auth** with internal-only access.

Recommended starting mode:
- magic link email login, or
- email/password for a very small internal user set

My preference for you:
- **magic link first**

Why:
- easy on iPhone
- no password-reset UX to build right away
- low-friction internal access

## Access model

### v1 policy
Only explicitly invited internal users should be able to sign in.

That means:
- no public signup
- only your approved email addresses
- `/crm/*` redirects unauthenticated users to `/crm/login`

## Recommended user flow

1. User opens `/crm`
2. App checks Supabase session
3. If no session:
   - redirect to `/crm/login`
4. User enters email
5. Supabase sends magic link
6. User opens link on iPhone or desktop
7. Session is established
8. App redirects to `/crm`

## Required pages

### `/crm/login`
Purpose:
- collect email
- request magic link
- explain that the CRM is internal-only

### `/crm`
Purpose:
- authenticated dashboard

### `/crm/*`
Purpose:
- all internal CRM screens

## Middleware / guard pattern

Recommended pattern in Astro:
- use middleware or page-level server checks
- verify Supabase session on every `/crm` route
- redirect to `/crm/login` if not authenticated

### Guard behavior
For unauthenticated requests to `/crm/*`:
- redirect to `/crm/login?next=<original-path>`

For authenticated requests:
- allow access

## Session handling

Recommended session handling:
- Supabase session cookie
- server-side verification on protected routes
- avoid client-only auth checks as the primary gate

Server-side protection matters because the CRM is internal operational data.

## Authorization scope for v1

### v1 simplest model
All authenticated internal users can:
- read/write clients
- read/write jobs
- read/write notes
- read/write tasks
- read/write file delivery records

This matches the current schema’s temporary authenticated-user RLS policies.

### Later refinement
When needed, add roles such as:
- `admin`
- `staff`
- `readonly`

But do not overbuild this on day one.

## Suggested environment variables

For the Bloomwood repo/app:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

Server-only if needed later:
- `SUPABASE_SERVICE_ROLE_KEY`

For the current scaffold, the Supabase magic-link redirect URL should be configured to allow:
- `https://bloomwood.com.au/crm/auth/callback`
- and your local/dev URL if you want to test outside production

## Suggested initial protected route behavior

### Middleware logic
If request path starts with `/crm`:
- allow `/crm/login`
- otherwise require valid session
- if missing, redirect to login

### Login page behavior
If already authenticated:
- redirect from `/crm/login` to `/crm`

## Recommended initial implementation order

1. add Supabase client helpers
2. add `/crm/login`
3. add `/crm` protected dashboard shell
4. add `/crm/*` route guard/middleware
5. test sign-in flow on iPhone

## Relationship to the download admin helper

The current route:
- `/solutions/download-admin`

is a temporary operational helper and should not become the core auth pattern.

Long term:
- CRM auth should be Supabase-based
- download admin functionality should either move into `/crm` or sit behind the same internal auth model

## Final recommendation

Use **Supabase Auth + protected `/crm/*` routes** as the real internal access model.

That gives you:
- mobile-friendly login
- clean separation from the public website
- a scalable base for the CRM without overcomplicating v1
