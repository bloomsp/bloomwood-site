-- Bloomwood CRM v1 schema
-- Intended for Supabase/Postgres

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  client_type text not null default 'person' check (client_type in ('person', 'company')),
  display_name text not null,
  first_name text,
  last_name text,
  business_name text,
  contact_name text,
  contact_role text,
  date_of_birth date,
  email text,
  phone text,
  address text,
  preferred_contact_method text check (preferred_contact_method in ('phone', 'email', 'sms', 'other')),
  tags text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive', 'lead', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_person_name_check check (
    client_type <> 'person' or first_name is not null or last_name is not null or display_name is not null
  ),
  constraint clients_company_name_check check (
    client_type <> 'company' or business_name is not null or display_name is not null
  )
);

create index if not exists idx_clients_client_type on public.clients(client_type);
create index if not exists idx_clients_status on public.clients(status);
create index if not exists idx_clients_display_name on public.clients(display_name);
create index if not exists idx_clients_business_name on public.clients(business_name);
create index if not exists idx_clients_email on public.clients(email);
create index if not exists idx_clients_phone on public.clients(phone);
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

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_reference text not null unique,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  category text not null check (category in ('repair', 'recovery', 'support', 'web', 'writing', 'flatpack', 'other')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'waiting_client', 'waiting_parts', 'ready', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  service_type_id uuid references public.service_types(id) on delete set null,
  device_type text,
  serial_number text,
  intake_details text,
  diagnosis text,
  resolution_summary text,
  billable_minutes integer not null default 0,
  hourly_rate_snapshot numeric(10,2),
  billing_increment_minutes_snapshot integer,
  calculated_billable_amount numeric(10,2) not null default 0,
  invoice_number text,
  invoice_status text not null default 'not_invoiced' check (invoice_status in ('not_invoiced', 'drafted', 'invoiced', 'paid', 'void')),
  invoiced_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_billable_minutes_check check (billable_minutes >= 0),
  constraint jobs_calculated_billable_amount_check check (calculated_billable_amount >= 0),
  constraint jobs_billing_increment_snapshot_check check (
    billing_increment_minutes_snapshot is null or billing_increment_minutes_snapshot > 0
  )
);

create index if not exists idx_jobs_client_id on public.jobs(client_id);
create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_jobs_priority on public.jobs(priority);
create index if not exists idx_jobs_category on public.jobs(category);
create index if not exists idx_jobs_service_type_id on public.jobs(service_type_id);
create index if not exists idx_jobs_invoice_number on public.jobs(invoice_number);
create index if not exists idx_jobs_invoice_status on public.jobs(invoice_status);
create index if not exists idx_jobs_opened_at on public.jobs(opened_at);

create table if not exists public.job_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  note_type text not null default 'internal' check (note_type in ('call', 'email', 'onsite', 'internal', 'recovery', 'delivery')),
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint job_notes_client_or_job_required check (client_id is not null or job_id is not null)
);

create index if not exists idx_job_notes_client_id on public.job_notes(client_id);
create index if not exists idx_job_notes_job_id on public.job_notes(job_id);
create index if not exists idx_job_notes_created_at on public.job_notes(created_at desc);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  title text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_client_or_job_required check (client_id is not null or job_id is not null)
);

create index if not exists idx_tasks_client_id on public.tasks(client_id);
create index if not exists idx_tasks_job_id on public.tasks(job_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due_at on public.tasks(due_at);

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

create table if not exists public.file_deliveries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  delivery_type text not null default 'download_link' check (delivery_type in ('download_link', 'usb', 'external_drive', 'email')),
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'link_issued', 'delivered', 'expired', 'revoked')),
  download_job_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_file_deliveries_job_id on public.file_deliveries(job_id);
create index if not exists idx_file_deliveries_status on public.file_deliveries(status);
create index if not exists idx_file_deliveries_download_job_id on public.file_deliveries(download_job_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

create or replace trigger trg_service_types_updated_at
before update on public.service_types
for each row
execute function public.set_updated_at();

create or replace trigger trg_jobs_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();

create or replace trigger trg_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

create or replace trigger trg_service_packs_updated_at
before update on public.service_packs
for each row
execute function public.set_updated_at();

create or replace trigger trg_file_deliveries_updated_at
before update on public.file_deliveries
for each row
execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.service_types enable row level security;
alter table public.jobs enable row level security;
alter table public.job_notes enable row level security;
alter table public.tasks enable row level security;
alter table public.service_packs enable row level security;
alter table public.service_pack_usage enable row level security;
alter table public.file_deliveries enable row level security;

-- Temporary internal-only policies for v1.
-- These assume all authenticated users are trusted internal users.
create policy "authenticated users can read clients"
on public.clients for select
using (auth.role() = 'authenticated');

create policy "authenticated users can insert clients"
on public.clients for insert
with check (auth.role() = 'authenticated');

create policy "authenticated users can update clients"
on public.clients for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

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

create policy "authenticated users can read jobs"
on public.jobs for select
using (auth.role() = 'authenticated');

create policy "authenticated users can insert jobs"
on public.jobs for insert
with check (auth.role() = 'authenticated');

create policy "authenticated users can update jobs"
on public.jobs for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated users can read notes"
on public.job_notes for select
using (auth.role() = 'authenticated');

create policy "authenticated users can insert notes"
on public.job_notes for insert
with check (auth.role() = 'authenticated');

create policy "authenticated users can update notes"
on public.job_notes for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated users can read tasks"
on public.tasks for select
using (auth.role() = 'authenticated');

create policy "authenticated users can insert tasks"
on public.tasks for insert
with check (auth.role() = 'authenticated');

create policy "authenticated users can update tasks"
on public.tasks for update
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

create policy "authenticated users can read file deliveries"
on public.file_deliveries for select
using (auth.role() = 'authenticated');

create policy "authenticated users can insert file deliveries"
on public.file_deliveries for insert
with check (auth.role() = 'authenticated');

create policy "authenticated users can update file deliveries"
on public.file_deliveries for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
