import test from 'node:test';
import assert from 'node:assert/strict';

import {
  allocatePackMinutes,
  deriveServicePacks,
  getTaskServicePackOptions,
  summarizeClientDirectory,
  summarizeJobsIndex,
} from '../src/lib/crm-metrics.mjs';

function makeFixture() {
  const clients = [
    { id: 'client-1', display_name: 'Client One' },
  ];

  const packs = [
    { id: 'pack-1', client_id: 'client-1', hours_purchased: 5, status: 'active' },
    { id: 'pack-2', client_id: 'client-1', hours_purchased: 2, status: 'active' },
  ];

  const jobs = [
    {
      id: 'job-1',
      client_id: 'client-1',
      status: 'in_progress',
      invoice_status: 'not_invoiced',
      billable_minutes: 360,
      hourly_rate_snapshot: 120,
      billing_increment_minutes_snapshot: 15,
    },
    {
      id: 'job-2',
      client_id: 'client-1',
      status: 'completed',
      invoice_status: 'invoiced',
      billable_minutes: 120,
      hourly_rate_snapshot: 120,
      billing_increment_minutes_snapshot: 15,
    },
  ];

  const tasks = [
    {
      id: 'task-1',
      client_id: 'client-1',
      job_id: 'job-1',
      status: 'done',
      billable_minutes: 60,
      service_pack_id: 'pack-1',
      completed_at: '2026-04-18T09:00:00.000Z',
      job: { hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15 },
    },
    {
      id: 'task-2',
      client_id: 'client-1',
      job_id: 'job-1',
      status: 'open',
      billable_minutes: 300,
      service_pack_id: 'pack-1',
      completed_at: '2026-04-18T10:00:00.000Z',
      job: { hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15 },
    },
    {
      id: 'task-3',
      client_id: 'client-1',
      job_id: 'job-2',
      status: 'done',
      billable_minutes: 120,
      service_pack_id: null,
      completed_at: '2026-04-18T11:00:00.000Z',
      job: { hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15 },
    },
  ];

  return { clients, packs, jobs, tasks };
}

test('allocates pack-covered and overflow minutes in chronological order', () => {
  const { packs, tasks } = makeFixture();
  const allocation = allocatePackMinutes({ packs, tasks });

  assert.deepEqual(allocation.taskBillingBreakdown.get('task-1'), {
    packCoveredMinutes: 60,
    overflowBillableMinutes: 0,
  });

  assert.deepEqual(allocation.taskBillingBreakdown.get('task-2'), {
    packCoveredMinutes: 240,
    overflowBillableMinutes: 60,
  });

  assert.deepEqual(allocation.taskBillingBreakdown.get('task-3'), {
    packCoveredMinutes: 0,
    overflowBillableMinutes: 120,
  });
});

test('derives service-pack used and remaining minutes from tasks', () => {
  const { packs, tasks } = makeFixture();
  const derivedPacks = deriveServicePacks(packs, tasks);
  const firstPack = derivedPacks.find((pack) => pack.id === 'pack-1');
  const secondPack = derivedPacks.find((pack) => pack.id === 'pack-2');

  assert.equal(firstPack.minutes_used, 300);
  assert.equal(firstPack.minutes_remaining, 0);
  assert.equal(firstPack.status, 'used_up');

  assert.equal(secondPack.minutes_used, 0);
  assert.equal(secondPack.minutes_remaining, 120);
  assert.equal(secondPack.status, 'active');
});

test('client directory summary only bills overflow outside service packs', () => {
  const { clients, jobs, tasks, packs } = makeFixture();
  const [client] = summarizeClientDirectory({ clients, jobs, tasks, packs });

  assert.equal(client.open_jobs, 1);
  assert.equal(client.open_tasks, 1);
  assert.equal(client.active_service_packs, 1);
  assert.equal(client.total_billable_hours, 3);
  assert.equal(client.total_billable_dollars, 360);
  assert.equal(client.total_invoiced, 240);
});

test('jobs index summary uses task-derived pack usage and open task counts', () => {
  const { jobs, tasks, packs } = makeFixture();
  const summaries = summarizeJobsIndex({ jobs, tasks, packs });
  const job1 = summaries.find((job) => job.id === 'job-1');
  const job2 = summaries.find((job) => job.id === 'job-2');

  assert.equal(job1.service_pack_usage_count, 2);
  assert.equal(job1.open_task_count, 1);
  assert.equal(job1.calculated_billable_amount, 120);

  assert.equal(job2.service_pack_usage_count, 0);
  assert.equal(job2.open_task_count, 0);
  assert.equal(job2.calculated_billable_amount, 240);
});

test('task selector keeps the currently selected pack even when no time remains', () => {
  const { packs, tasks } = makeFixture();
  const derivedPacks = deriveServicePacks(packs, tasks);
  const available = derivedPacks.filter((pack) => pack.status === 'active' && pack.minutes_remaining > 0);
  const options = getTaskServicePackOptions({
    availableServicePacks: available,
    servicePacks: derivedPacks,
    task: tasks[1],
  });

  assert.equal(options[0].id, 'pack-1');
  assert.equal(options.some((pack) => pack.id === 'pack-2'), true);
});
