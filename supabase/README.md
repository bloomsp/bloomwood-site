# Supabase files for Bloomwood CRM

## Files
- `migrations/20260417121000_crm_v1.sql`
- `seed.sql`
- `crm-v1-schema.sql`

## Recommended use

### Apply the migration
Use this migration as the source of truth:
- `migrations/20260417121000_crm_v1.sql`

### Seed local/dev data
Use:
- `seed.sql`

### Reference schema snapshot
`crm-v1-schema.sql` is the readable schema snapshot/planning copy.
It can be kept for reference, but the migration file should drive real database changes.
