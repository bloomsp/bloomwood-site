-- Bloomwood CRM task time, pack usage, and expiry defaults

alter table public.tasks
  add column if not exists service_pack_id uuid references public.service_packs(id) on delete set null,
  add column if not exists time_taken_minutes integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_time_taken_minutes_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_time_taken_minutes_check
      check (time_taken_minutes >= 0);
  end if;
end $$;

create index if not exists idx_tasks_service_pack_id on public.tasks(service_pack_id);

update public.service_packs
set
  minutes_purchased = case
    when coalesce(minutes_purchased, 0) = 0 and coalesce(hours_purchased, 0) > 0 then round(hours_purchased * 60)
    else minutes_purchased
  end,
  expiry_date = coalesce(expiry_date, purchase_date + interval '12 months')
where coalesce(minutes_purchased, 0) = 0
   or expiry_date is null;
