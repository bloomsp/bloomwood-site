-- Bloomwood CRM schema extension for service billing, packs, and mixed client types

alter table public.clients
  add column if not exists client_type text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists contact_name text,
  add column if not exists contact_role text,
  add column if not exists date_of_birth date;

update public.clients
set client_type = case
  when business_name is not null and btrim(business_name) <> '' then 'company'
  else 'person'
end
where client_type is null;

alter table public.clients
  alter column client_type set default 'person';

alter table public.clients
  alter column client_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_client_type_check'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_client_type_check
      check (client_type in ('person', 'company'));
  end if;
end $$;

create index if not exists idx_clients_client_type on public.clients(client_type);
create index if not exists idx_clients_date_of_birth on public.clients(date_of_birth);

create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  item_code text not null unique,
  billing_mode text not null default 'hourly' check (billing_mode in ('hourly', 'fixed_bundle')),
  hourly_rate numeric(10,2),
  billing_increment_minutes integer,
  is_service_pack boolean not null default false,
  pack_hours numeric(10,2),
  pack_price numeric(10,2),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_types_hourly_fields_check check (
    (billing_mode <> 'hourly')
    or (hourly_rate is not null and billing_increment_minutes is not null and pack_hours is null and pack_price is null)
  ),
  constraint service_types_bundle_fields_check check (
    (billing_mode <> 'fixed_bundle')
    or (pack_hours is not null and pack_price is not null and hourly_rate is null and billing_increment_minutes is null)
  )
);

create index if not exists idx_service_types_active on public.service_types(active);
create index if not exists idx_service_types_sort_order on public.service_types(sort_order);
create index if not exists idx_service_types_is_service_pack on public.service_types(is_service_pack);

alter table public.jobs
  add column if not exists service_type_id uuid references public.service_types(id) on delete set null,
  add column if not exists billable_minutes integer not null default 0,
  add column if not exists hourly_rate_snapshot numeric(10,2),
  add column if not exists billing_increment_minutes_snapshot integer,
  add column if not exists calculated_billable_amount numeric(10,2) not null default 0,
  add column if not exists invoice_number text,
  add column if not exists invoice_status text not null default 'not_invoiced',
  add column if not exists invoiced_at timestamptz;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'jobs_category_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs drop constraint jobs_category_check;
  end if;
end $$;

alter table public.jobs
  add constraint jobs_category_check
  check (category in ('repair', 'recovery', 'support', 'web', 'writing', 'flatpack', 'other'));

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'jobs_invoice_status_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs drop constraint jobs_invoice_status_check;
  end if;
end $$;

alter table public.jobs
  add constraint jobs_invoice_status_check
  check (invoice_status in ('not_invoiced', 'drafted', 'invoiced', 'paid', 'void'));

create index if not exists idx_jobs_service_type_id on public.jobs(service_type_id);
create index if not exists idx_jobs_invoice_number on public.jobs(invoice_number);
create index if not exists idx_jobs_invoice_status on public.jobs(invoice_status);

create table if not exists public.service_packs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  hours_purchased numeric(10,2) not null,
  minutes_purchased integer not null,
  minutes_used integer not null default 0,
  purchase_price numeric(10,2) not null,
  purchase_date date not null default current_date,
  expiry_date date,
  status text not null default 'active' check (status in ('active', 'used_up', 'expired', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_packs_minutes_purchased_check check (minutes_purchased >= 0),
  constraint service_packs_minutes_used_check check (minutes_used >= 0 and minutes_used <= minutes_purchased),
  constraint service_packs_hours_purchased_check check (hours_purchased >= 0),
  constraint service_packs_purchase_price_check check (purchase_price >= 0)
);

create index if not exists idx_service_packs_client_id on public.service_packs(client_id);
create index if not exists idx_service_packs_service_type_id on public.service_packs(service_type_id);
create index if not exists idx_service_packs_status on public.service_packs(status);
create index if not exists idx_service_packs_purchase_date on public.service_packs(purchase_date desc);

create table if not exists public.service_pack_usage (
  id uuid primary key default gen_random_uuid(),
  service_pack_id uuid not null references public.service_packs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  minutes_applied integer not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint service_pack_usage_minutes_applied_check check (minutes_applied > 0),
  constraint service_pack_usage_unique_job_pack unique (service_pack_id, job_id)
);

create index if not exists idx_service_pack_usage_service_pack_id on public.service_pack_usage(service_pack_id);
create index if not exists idx_service_pack_usage_job_id on public.service_pack_usage(job_id);

create or replace trigger trg_service_types_updated_at
before update on public.service_types
for each row
execute function public.set_updated_at();

create or replace trigger trg_service_packs_updated_at
before update on public.service_packs
for each row
execute function public.set_updated_at();

alter table public.service_types enable row level security;
alter table public.service_packs enable row level security;
alter table public.service_pack_usage enable row level security;

create policy "authenticated users can read service types"
on public.service_types for select
using (auth.role() = 'authenticated');

create policy "authenticated users can insert service types"
on public.service_types for insert
with check (auth.role() = 'authenticated');

create policy "authenticated users can update service types"
on public.service_types for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated users can read service packs"
on public.service_packs for select
using (auth.role() = 'authenticated');

create policy "authenticated users can insert service packs"
on public.service_packs for insert
with check (auth.role() = 'authenticated');

create policy "authenticated users can update service packs"
on public.service_packs for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated users can read service pack usage"
on public.service_pack_usage for select
using (auth.role() = 'authenticated');

create policy "authenticated users can insert service pack usage"
on public.service_pack_usage for insert
with check (auth.role() = 'authenticated');

create policy "authenticated users can update service pack usage"
on public.service_pack_usage for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

insert into public.service_types (slug, name, item_code, billing_mode, hourly_rate, billing_increment_minutes, is_service_pack, pack_hours, pack_price, sort_order)
values
  ('onsite-support', 'Onsite support', 'IT120', 'hourly', 120.00, 30, false, null, null, 10),
  ('remote-support', 'Remote support', 'ITRemote', 'hourly', 80.00, 15, false, null, null, 20),
  ('onsite-support-special-80', 'Onsite Support special 80', 'ITSpec80', 'hourly', 80.00, 15, false, null, null, 30),
  ('onsite-support-special-100', 'Onsite Support special 100', 'IT100', 'hourly', 100.00, 30, false, null, null, 40),
  ('flatpack-furniture-assembly', 'Flatpack furniture assembly', 'FA40', 'hourly', 40.00, 30, false, null, null, 50),
  ('service-pack-explorer', 'Explorer 5 hours', 'PACK-EXPLORER-5', 'fixed_bundle', null, null, true, 5, 570, 100),
  ('service-pack-adventurer', 'Adventurer 10 hours', 'PACK-ADVENTURER-10', 'fixed_bundle', null, null, true, 10, 1080, 110),
  ('service-pack-hero', 'Hero 20 hours', 'PACK-HERO-20', 'fixed_bundle', null, null, true, 20, 2040, 120),
  ('service-pack-legend', 'Legend 40 hours', 'PACK-LEGEND-40', 'fixed_bundle', null, null, true, 40, 3840, 130)
on conflict (slug) do update
set
  name = excluded.name,
  item_code = excluded.item_code,
  billing_mode = excluded.billing_mode,
  hourly_rate = excluded.hourly_rate,
  billing_increment_minutes = excluded.billing_increment_minutes,
  is_service_pack = excluded.is_service_pack,
  pack_hours = excluded.pack_hours,
  pack_price = excluded.pack_price,
  sort_order = excluded.sort_order;
