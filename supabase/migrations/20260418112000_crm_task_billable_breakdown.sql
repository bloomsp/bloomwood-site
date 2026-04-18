-- Bloomwood CRM task billable/non-billable breakdown

alter table public.tasks
  add column if not exists billable_minutes integer not null default 0,
  add column if not exists non_billable_minutes integer not null default 0;

update public.tasks
set billable_minutes = coalesce(time_taken_minutes, 0)
where coalesce(billable_minutes, 0) = 0
  and coalesce(non_billable_minutes, 0) = 0
  and coalesce(time_taken_minutes, 0) > 0;

update public.tasks
set time_taken_minutes = coalesce(billable_minutes, 0) + coalesce(non_billable_minutes, 0)
where coalesce(time_taken_minutes, 0) <> coalesce(billable_minutes, 0) + coalesce(non_billable_minutes, 0);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'tasks_time_taken_minutes_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks drop constraint tasks_time_taken_minutes_check;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_billable_minutes_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_billable_minutes_check
      check (billable_minutes >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_non_billable_minutes_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_non_billable_minutes_check
      check (non_billable_minutes >= 0);
  end if;

  alter table public.tasks
    add constraint tasks_time_taken_minutes_check
    check (time_taken_minutes >= 0 and time_taken_minutes = billable_minutes + non_billable_minutes);
exception
  when duplicate_object then null;
end $$;
