-- CRM invoices and invoice line items

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_number text,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'void')),
  external_provider text,
  external_invoice_id text,
  issued_at timestamptz,
  paid_at timestamptz,
  notes text,
  total_amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_client_id on public.invoices(client_id);
create index if not exists idx_invoices_invoice_number on public.invoices(invoice_number);
create index if not exists idx_invoices_status on public.invoices(status);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  source_type text not null check (source_type in ('job', 'task', 'manual', 'service_pack')),
  job_id uuid references public.jobs(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  service_pack_id uuid references public.service_packs(id) on delete set null,
  description text not null,
  quantity numeric(10,2),
  unit_amount numeric(10,2),
  amount numeric(10,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_line_items_source_ref_check check (
    (source_type = 'job' and job_id is not null and task_id is null and service_pack_id is null)
    or (source_type = 'task' and task_id is not null and job_id is null and service_pack_id is null)
    or (source_type = 'service_pack' and service_pack_id is not null and job_id is null and task_id is null)
    or (source_type = 'manual' and job_id is null and task_id is null and service_pack_id is null)
  )
);

create unique index if not exists idx_invoice_line_items_unique_job on public.invoice_line_items(job_id) where job_id is not null;
create unique index if not exists idx_invoice_line_items_unique_task on public.invoice_line_items(task_id) where task_id is not null;
create index if not exists idx_invoice_line_items_invoice_id on public.invoice_line_items(invoice_id);
create index if not exists idx_invoice_line_items_job_id on public.invoice_line_items(job_id);
create index if not exists idx_invoice_line_items_task_id on public.invoice_line_items(task_id);

create or replace function public.sync_invoice_total(invoice_uuid uuid)
returns void
language sql
as $$
  update public.invoices
  set total_amount = coalesce((
    select sum(amount)
    from public.invoice_line_items
    where invoice_id = invoice_uuid
  ), 0),
  updated_at = now()
  where id = invoice_uuid;
$$;

create or replace function public.trg_sync_invoice_total()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_invoice_total(old.invoice_id);
    return old;
  end if;

  perform public.sync_invoice_total(new.invoice_id);
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    perform public.sync_invoice_total(old.invoice_id);
  end if;
  return new;
end;
$$;

create or replace trigger trg_invoices_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

create or replace trigger trg_invoice_line_items_sync_total
after insert or update or delete on public.invoice_line_items
for each row
execute function public.trg_sync_invoice_total();

alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;

create policy "authenticated users can read invoices"
on public.invoices for select
using (auth.role() = 'authenticated');

create policy "authenticated users can insert invoices"
on public.invoices for insert
with check (auth.role() = 'authenticated');

create policy "authenticated users can update invoices"
on public.invoices for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated users can read invoice line items"
on public.invoice_line_items for select
using (auth.role() = 'authenticated');

create policy "authenticated users can insert invoice line items"
on public.invoice_line_items for insert
with check (auth.role() = 'authenticated');

create policy "authenticated users can update invoice line items"
on public.invoice_line_items for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
