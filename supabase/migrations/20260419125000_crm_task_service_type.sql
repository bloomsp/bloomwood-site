-- Allow standalone client tasks to carry their own service type/rate source

alter table public.tasks
  add column if not exists service_type_id uuid references public.service_types(id) on delete set null;

create index if not exists idx_tasks_service_type_id on public.tasks(service_type_id);
