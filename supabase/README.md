# Supabase files for Bloomwood CRM

## Files
- `migrations/` — ordered migration history for the CRM schema
- `seed.sql` — local/dev starter data
- `crm-v1-schema.sql` — readable schema snapshot/reference copy

## Recommended use

### Source of truth
Use the full `migrations/` directory as the source of truth for real database changes.

Important:
- `migrations/20260417121000_crm_v1.sql` is the **base migration**, not the full current schema by itself
- later migrations extend and refine billing, service packs, task time rules, invoice handling, and related CRM behavior
- for a fresh setup, apply the full migration chain in timestamp order

### Base migration
`migrations/20260417121000_crm_v1.sql` creates the initial CRM core, including:
- `clients`
- `jobs`
- `job_notes`
- `tasks`
- `file_deliveries`
- shared updated-at trigger and initial RLS policies

### Later migrations
Later files in `migrations/` build on that base rather than replacing it.

### Seed local/dev data
Use:
- `seed.sql`

### Reference schema snapshot
`crm-v1-schema.sql` is the readable schema snapshot/planning copy.
It is useful for review, but the migration history should drive actual database state.
