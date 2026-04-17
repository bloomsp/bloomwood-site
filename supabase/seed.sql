-- Bloomwood CRM v1 seed data
-- Safe starter records for local/dev environments

insert into public.service_types (
  id,
  slug,
  name,
  item_code,
  billing_mode,
  hourly_rate,
  billing_increment_minutes,
  is_service_pack,
  sort_order
)
values
  ('aaaaaaa1-1111-1111-1111-111111111111', 'onsite-support', 'Onsite support', 'IT120', 'hourly', 120.00, 30, false, 10),
  ('aaaaaaa2-2222-2222-2222-222222222222', 'remote-support', 'Remote support', 'ITRemote', 'hourly', 80.00, 15, false, 20),
  ('aaaaaaa3-3333-3333-3333-333333333333', 'onsite-support-special-80', 'Onsite Support special 80', 'ITSpec80', 'hourly', 80.00, 15, false, 30),
  ('aaaaaaa4-4444-4444-4444-444444444444', 'onsite-support-special-100', 'Onsite Support special 100', 'IT100', 'hourly', 100.00, 30, false, 40),
  ('aaaaaaa5-5555-5555-5555-555555555555', 'flatpack-furniture-assembly', 'Flatpack furniture assembly', 'FA40', 'hourly', 40.00, 30, false, 50),
  ('aaaaaaa6-6666-6666-6666-666666666666', 'service-pack-explorer', 'Explorer 5 hours', 'PACK-EXPLORER-5', 'fixed_bundle', null, null, true, 100),
  ('aaaaaaa7-7777-7777-7777-777777777777', 'service-pack-adventurer', 'Adventurer 10 hours', 'PACK-ADVENTURER-10', 'fixed_bundle', null, null, true, 110),
  ('aaaaaaa8-8888-8888-8888-888888888888', 'service-pack-hero', 'Hero 20 hours', 'PACK-HERO-20', 'fixed_bundle', null, null, true, 120),
  ('aaaaaaa9-9999-9999-9999-999999999999', 'service-pack-legend', 'Legend 40 hours', 'PACK-LEGEND-40', 'fixed_bundle', null, null, true, 130)
on conflict (id) do nothing;

update public.service_types
set pack_hours = case id
  when 'aaaaaaa6-6666-6666-6666-666666666666' then 5
  when 'aaaaaaa7-7777-7777-7777-777777777777' then 10
  when 'aaaaaaa8-8888-8888-8888-888888888888' then 20
  when 'aaaaaaa9-9999-9999-9999-999999999999' then 40
  else pack_hours
end,
pack_price = case id
  when 'aaaaaaa6-6666-6666-6666-666666666666' then 570
  when 'aaaaaaa7-7777-7777-7777-777777777777' then 1080
  when 'aaaaaaa8-8888-8888-8888-888888888888' then 2040
  when 'aaaaaaa9-9999-9999-9999-999999999999' then 3840
  else pack_price
end
where id in (
  'aaaaaaa6-6666-6666-6666-666666666666',
  'aaaaaaa7-7777-7777-7777-777777777777',
  'aaaaaaa8-8888-8888-8888-888888888888',
  'aaaaaaa9-9999-9999-9999-999999999999'
);

insert into public.clients (
  id,
  client_type,
  display_name,
  first_name,
  last_name,
  date_of_birth,
  email,
  phone,
  preferred_contact_method,
  tags,
  status
)
values (
  '11111111-1111-1111-1111-111111111111',
  'person',
  'Jane Citizen',
  'Jane',
  'Citizen',
  date '1990-04-12',
  'jane@example.com',
  '0400000000',
  'email',
  array['recovery'],
  'active'
)
on conflict (id) do nothing;

insert into public.jobs (
  id,
  job_reference,
  client_id,
  title,
  category,
  status,
  priority,
  service_type_id,
  device_type,
  intake_details,
  billable_minutes,
  hourly_rate_snapshot,
  billing_increment_minutes_snapshot,
  calculated_billable_amount,
  invoice_status,
  opened_at
)
values (
  '22222222-2222-2222-2222-222222222222',
  '2026-0042',
  '11111111-1111-1111-1111-111111111111',
  'Recovered family photos from damaged drive',
  'recovery',
  'in_progress',
  'normal',
  'aaaaaaa1-1111-1111-1111-111111111111',
  'External hard drive',
  'Client reported read errors and inaccessible folders.',
  120,
  120.00,
  30,
  240.00,
  'not_invoiced',
  now()
)
on conflict (id) do nothing;

insert into public.job_notes (
  id,
  client_id,
  job_id,
  note_type,
  body
)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'recovery',
  'Initial recovery pass completed. Photo set appears intact.'
)
on conflict (id) do nothing;

insert into public.tasks (
  id,
  client_id,
  job_id,
  title,
  details,
  status,
  due_at
)
values (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'Send recovery update',
  'Confirm successful recovery and advise next delivery step.',
  'open',
  now() + interval '1 day'
)
on conflict (id) do nothing;

insert into public.service_packs (
  id,
  client_id,
  service_type_id,
  hours_purchased,
  minutes_purchased,
  minutes_used,
  purchase_price,
  purchase_date,
  status,
  notes
)
values (
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaa7-7777-7777-7777-777777777777',
  10,
  600,
  120,
  1080.00,
  current_date,
  'active',
  'Starter prepaid support pack for ongoing support.'
)
on conflict (id) do nothing;

insert into public.service_pack_usage (
  id,
  service_pack_id,
  job_id,
  minutes_applied,
  notes
)
values (
  '77777777-7777-7777-7777-777777777777',
  '66666666-6666-6666-6666-666666666666',
  '22222222-2222-2222-2222-222222222222',
  120,
  'Applied two hours from the Adventurer service pack.'
)
on conflict (id) do nothing;

insert into public.file_deliveries (
  id,
  job_id,
  delivery_type,
  status,
  notes
)
values (
  '55555555-5555-5555-5555-555555555555',
  '22222222-2222-2222-2222-222222222222',
  'download_link',
  'pending',
  'Waiting for upload and link issuance.'
)
on conflict (id) do nothing;
