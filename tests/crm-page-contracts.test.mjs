import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClientInvoiceLineItems,
  formatCrmTimestamp,
  summarizeClientDetail,
  summarizeJobDetail,
  summarizeServicePackDetail,
  validateClientInvoiceSelection,
} from '../src/lib/crm-page-contracts.mjs';

function makeFixture() {
  const servicePack = {
    id: 'pack-1',
    client_id: 'client-1',
    hours_purchased: 5,
    minutes_purchased: 300,
    minutes_used: 999,
    purchase_price: 570,
    status: 'active',
  };

  const secondPack = {
    id: 'pack-2',
    client_id: 'client-1',
    hours_purchased: 2,
    minutes_purchased: 120,
    minutes_used: 0,
    purchase_price: 240,
    status: 'active',
  };

  const job1 = {
    id: 'job-1',
    client_id: 'client-1',
    job_reference: 'JOB-001',
    title: 'Primary support job',
    status: 'in_progress',
    billable_minutes: 360,
    calculated_billable_amount: 720,
    hourly_rate_snapshot: 120,
    billing_increment_minutes_snapshot: 15,
    invoice_number: null,
  };

  const job2 = {
    id: 'job-2',
    client_id: 'client-1',
    job_reference: 'JOB-002',
    title: 'Completed invoiced job',
    status: 'completed',
    billable_minutes: 120,
    calculated_billable_amount: 240,
    hourly_rate_snapshot: 120,
    billing_increment_minutes_snapshot: 15,
    invoice_number: 'INV-001',
  };

  const invoices = [
    { id: 'inv-1', client_id: 'client-1', invoice_number: 'INV-001', total_amount: 240 },
  ];

  const invoiceLineItems = [
    { id: 'ili-1', invoice_id: 'inv-1', source_type: 'job', job_id: 'job-2', task_id: null },
  ];

  const tasks = [
    {
      id: 'task-1',
      client_id: 'client-1',
      job_id: 'job-1',
      status: 'done',
      billable_minutes: 60,
      non_billable_minutes: 0,
      service_pack_id: 'pack-1',
      completed_at: '2026-04-18T09:00:00.000Z',
      job: { invoice_number: null, hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15 },
    },
    {
      id: 'task-2',
      client_id: 'client-1',
      job_id: 'job-1',
      status: 'open',
      billable_minutes: 300,
      non_billable_minutes: 30,
      service_pack_id: 'pack-1',
      completed_at: '2026-04-18T10:00:00.000Z',
      job: { invoice_number: null, hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15 },
    },
    {
      id: 'task-3',
      client_id: 'client-1',
      job_id: 'job-2',
      status: 'done',
      billable_minutes: 120,
      non_billable_minutes: 0,
      service_pack_id: null,
      completed_at: '2026-04-18T11:00:00.000Z',
      job: { invoice_number: 'INV-001', hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15 },
    },
    {
      id: 'task-4',
      client_id: 'client-1',
      job_id: null,
      title: 'Standalone follow-up',
      status: 'open',
      billable_minutes: 90,
      non_billable_minutes: 0,
      service_pack_id: null,
      completed_at: '2026-04-18T12:00:00.000Z',
      service_type: { name: 'Support', hourly_rate: 80, billing_increment_minutes: 15 },
    },
  ];

  return {
    servicePacks: [servicePack, secondPack],
    jobs: [job1, job2],
    tasks,
    job1,
    servicePack,
    invoices,
    invoiceLineItems,
  };
}

test('client detail contract stays aligned across summary cards and pack list', () => {
  const { jobs, tasks, servicePacks, invoices, invoiceLineItems } = makeFixture();
  const summary = summarizeClientDetail({ jobs, tasks, packs: servicePacks, invoices, invoiceLineItems });

  assert.equal(summary.activeJobs, 1);
  assert.equal(summary.taskCount, 4);
  assert.equal(summary.totalBillableMinutes, 570);
  assert.equal(summary.totalPackCoveredMinutes, 300);
  assert.equal(summary.totalToBeInvoicedMinutes, 150);
  assert.equal(summary.totalToBeInvoicedDollars, 240);
  assert.equal(summary.totalInvoiced, 240);
  assert.equal(summary.totalServicePackPurchased, 810);
  assert.equal(summary.totalRevenue, 1050);
  assert.equal(summary.totalPackMinutesRemaining, 120);

  const pack1 = summary.servicePacks.find((pack) => pack.id === 'pack-1');
  const pack2 = summary.servicePacks.find((pack) => pack.id === 'pack-2');
  assert.equal(pack1.minutes_used, 300);
  assert.equal(pack1.minutes_remaining, 0);
  assert.equal(pack2.minutes_remaining, 120);
  assert.equal(summary.jobBillingBreakdown.get('job-1')?.stillBillableMinutes, 60);
  assert.equal(summary.jobBillingBreakdown.get('job-1')?.stillBillableAmount, 120);
  assert.equal(summary.jobBillingBreakdown.get('job-2')?.stillBillableAmount, 240);
});

test('job detail contract splits estimate, actual, pack-covered, and still-billable consistently', () => {
  const { tasks, servicePacks, job1 } = makeFixture();
  const jobTasks = tasks.filter((task) => task.job_id === 'job-1');
  const summary = summarizeJobDetail({
    job: job1,
    tasks: jobTasks,
    servicePacks,
    clientPackTasks: tasks,
  });

  assert.equal(summary.estimatedBillableMinutes, 360);
  assert.equal(summary.actualBillableMinutes, 360);
  assert.equal(summary.actualNonBillableMinutes, 30);
  assert.equal(summary.openTaskCount, 1);
  assert.equal(summary.estimatedBillableAmount, 720);
  assert.equal(summary.actualBillableAmount, 720);
  assert.equal(summary.totalPackCoveredMinutes, 300);
  assert.equal(summary.totalStillBillableMinutes, 60);
  assert.equal(summary.totalStillBillableAmount, 120);
});

test('service pack detail contract keeps header totals aligned with task rows', () => {
  const { tasks, servicePack } = makeFixture();
  const packTasks = tasks.filter((task) => task.service_pack_id === 'pack-1');
  const summary = summarizeServicePackDetail({ servicePack, tasks: packTasks });

  assert.equal(summary.minutesPurchased, 300);
  assert.equal(summary.actualMinutesUsed, 300);
  assert.equal(summary.actualMinutesRemaining, 0);

  const secondTask = summary.tasksWithPackCoverage.find((task) => task.id === 'task-2');
  assert.equal(secondTask.pack_covered_minutes, 240);
  assert.equal(secondTask.overflow_billable_minutes, 60);
});

test('client invoice line item builder derives selected job and standalone task amounts from summary data', () => {
  const { jobs, tasks, servicePacks, invoices, invoiceLineItems } = makeFixture();
  const summary = summarizeClientDetail({ jobs, tasks, packs: servicePacks, invoices, invoiceLineItems });
  const selectedJobs = jobs.filter((job) => job.id === 'job-1');
  const selectedTasks = tasks.filter((task) => task.id === 'task-4');

  const lineItems = buildClientInvoiceLineItems({
    invoiceId: 'inv-new',
    selectedJobs,
    selectedTasks,
    summary,
  });

  assert.equal(lineItems.length, 2);
  assert.deepEqual(lineItems[0], {
    invoice_id: 'inv-new',
    source_type: 'job',
    job_id: 'job-1',
    description: 'JOB-001 · Primary support job',
    amount: 120,
    sort_order: 0,
  });
  assert.deepEqual(lineItems[1], {
    invoice_id: 'inv-new',
    source_type: 'task',
    task_id: 'task-4',
    description: 'Standalone follow-up · Support',
    quantity: 1.5,
    unit_amount: 80,
    amount: 120,
    sort_order: 1,
  });
});

test('client invoice selection validation requires at least one selected item', () => {
  assert.equal(validateClientInvoiceSelection({ selectedJobIds: [], selectedTaskIds: [] }), 'Select at least one job or standalone task to include in the invoice.');
  assert.equal(validateClientInvoiceSelection({ selectedJobIds: ['job-1'], selectedTaskIds: [] }), null);
  assert.equal(validateClientInvoiceSelection({ selectedJobIds: [], selectedTaskIds: ['task-4'] }), null);
});

test('crm timestamp formatter normalizes iso strings to yyyy-mm-dd hh:mm:ss', () => {
  assert.equal(formatCrmTimestamp('2026-04-19T06:07:08.999Z').startsWith('2026-04-19 '), true);
  assert.equal(formatCrmTimestamp('2026-04-19T06:07:08.999Z').endsWith('06:07:08') || formatCrmTimestamp('2026-04-19T06:07:08.999Z').endsWith('16:07:08'), true);
  assert.equal(formatCrmTimestamp('2026-04-19 12:34:56'), '2026-04-19 12:34:56');
});
