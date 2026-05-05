-- Bloomwood CRM v1 schema
-- Intended for Supabase/Postgres migrations

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  business_name text,
  email text,
  phone text,
  address text,
  preferred_contact_method text check (preferred_contact_method in ('phone', 'email', 'sms', 'other')),
  tags text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive', 'lead', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clients_status on public.clients(status);
create index if not exists idx_clients_display_name on public.clients(display_name);
create index if not exists idx_clients_business_name on public.clients(business_name);
create index if not exists idx_clients_email on public.clients(email);
create index if not exists idx_clients_phone on public.clients(phone);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_reference text not null unique,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  category text not null check (category in ('repair', 'recovery', 'support', 'web', 'writing', 'other')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'waiting_client', 'waiting_parts', 'ready', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  device_type text,
  serial_number text,
  intake_details text,
  diagnosis text,
  resolution_summary text,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jobs_client_id on public.jobs(client_id);
create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_jobs_priority on public.jobs(priority);
create index if not exists idx_jobs_category on public.jobs(category);
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

create or replace trigger trg_jobs_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();

create or replace trigger trg_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

create or replace trigger trg_file_deliveries_updated_at
before update on public.file_deliveries
for each row
execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.jobs enable row level security;
alter table public.job_notes enable row level security;
alter table public.tasks enable row level security;
alter table public.file_deliveries enable row level security;

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
