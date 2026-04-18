-- Rename drafted invoice status to ready_to_invoice

update public.jobs
set invoice_status = 'ready_to_invoice'
where invoice_status = 'drafted';

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
  check (invoice_status in ('not_invoiced', 'ready_to_invoice', 'invoiced', 'paid', 'void'));
