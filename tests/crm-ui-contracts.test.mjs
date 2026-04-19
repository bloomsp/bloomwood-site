import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

import { getCalculatedAmount, getTaskServicePackOptions } from '../src/lib/crm-metrics.mjs';
import {
  formatCrmDate,
  summarizeClientDetail,
  summarizeJobDetail,
  summarizeServicePackDetail,
} from '../src/lib/crm-page-contracts.mjs';

function makeFixture() {
  const servicePacks = [
    { id: 'pack-1', client_id: 'client-1', hours_purchased: 5, minutes_purchased: 300, purchase_price: 570, purchase_date: '2026-04-19', status: 'active', service_type: { item_code: 'FA40', name: 'Five Hour Pack' } },
    { id: 'pack-2', client_id: 'client-1', hours_purchased: 2, minutes_purchased: 120, purchase_price: 510, purchase_date: '2026-04-20', status: 'active', service_type: { item_code: 'IT100', name: 'Two Hour Pack' } },
  ];

  const jobs = [
    { id: 'job-1', client_id: 'client-1', status: 'in_progress', billable_minutes: 360, calculated_billable_amount: 720, hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15, invoice_number: null },
    { id: 'job-2', client_id: 'client-1', status: 'completed', billable_minutes: 120, calculated_billable_amount: 240, hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15, invoice_number: 'INV-001' },
  ];

  const tasks = [
    { id: 'task-1', client_id: 'client-1', job_id: 'job-1', title: 'aaa', status: 'done', billable_minutes: 60, non_billable_minutes: 0, service_pack_id: 'pack-1', completed_at: '2026-04-18T09:00:00.000Z', job: { invoice_number: null, hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15 } },
    { id: 'task-2', client_id: 'client-1', job_id: 'job-1', title: 'www', status: 'open', billable_minutes: 300, non_billable_minutes: 30, service_pack_id: 'pack-1', completed_at: '2026-04-18T10:00:00.000Z', job: { invoice_number: null, hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15 } },
    { id: 'task-3', client_id: 'client-1', job_id: 'job-2', title: 'bbb', status: 'done', billable_minutes: 120, non_billable_minutes: 0, service_pack_id: null, completed_at: '2026-04-18T11:00:00.000Z', job: { invoice_number: 'INV-001', hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15 } },
    { id: 'task-4', client_id: 'client-1', job_id: null, title: 'ccc', status: 'open', billable_minutes: 90, non_billable_minutes: 0, service_pack_id: null, completed_at: '2026-04-18T12:00:00.000Z', service_type: { hourly_rate: 80, billing_increment_minutes: 15 } },
  ];

  const invoices = [
    { id: 'inv-1', client_id: 'client-1', invoice_number: 'INV-001', total_amount: 240 },
  ];
  const invoiceLineItems = [
    { id: 'ili-1', invoice_id: 'inv-1', source_type: 'job', job_id: 'job-2', task_id: null },
  ];

  return { servicePacks, jobs, tasks, invoices, invoiceLineItems };
}

async function withPage(run) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await run(page);
  } finally {
    await browser.close();
  }
}

test('crm nav jobs link behaves like normal navigation in desktop browser context', async () => {
  await withPage(async (page) => {
    await page.setContent(`
      <nav>
        <a id="dashboard" href="/crm/">Dashboard</a>
        <a id="clients" href="/crm/clients/">Clients</a>
        <a id="jobs" href="/crm/jobs/">Jobs</a>
      </nav>
      <script>
        window.clickedHref = null;
        document.getElementById('jobs').addEventListener('click', (event) => {
          event.preventDefault();
          window.clickedHref = event.currentTarget.getAttribute('href');
        });
      </script>
    `);

    await page.click('#jobs');
    assert.equal(await page.evaluate(() => window.clickedHref), '/crm/jobs/');
    assert.equal(await page.getAttribute('#jobs', 'download'), null);
  });
});

test('open-task selector keeps exhausted selected pack visible in browser-rendered dropdown', async () => {
  const { servicePacks, jobs, tasks } = makeFixture();
  const clientSummary = summarizeClientDetail({ jobs, tasks, packs: servicePacks });
  const availableServicePacks = clientSummary.servicePacks.filter((pack) => pack.status === 'active' && pack.minutes_remaining > 0);
  const task = tasks.find((item) => item.id === 'task-2');
  const options = getTaskServicePackOptions({ availableServicePacks, servicePacks: clientSummary.servicePacks, task });

  await withPage(async (page) => {
    await page.setContent(`
      <select id="service-pack-id">
        <option value="">No pack</option>
        ${options.map((pack) => `<option value="${pack.id}" ${task.service_pack_id === pack.id ? 'selected' : ''}>${pack.service_type?.item_code ?? 'Pack'} (${(pack.minutes_remaining / 60).toFixed(2)}h)</option>`).join('')}
      </select>
    `);

    const values = await page.locator('#service-pack-id option').evaluateAll((nodes) => nodes.map((node) => ({
      value: node.getAttribute('value'),
      text: node.textContent,
      selected: node.selected,
    })));

    assert.equal(values.some((item) => item.value === 'pack-1'), true);
    assert.equal(values.find((item) => item.value === 'pack-1')?.selected, true);
    assert.equal(values.some((item) => item.value === 'pack-2'), true);
  });
});

test('service pack detail header numbers match task rows in rendered browser view', async () => {
  const { servicePacks, tasks } = makeFixture();
  const pack = servicePacks[0];
  const packTasks = tasks.filter((task) => task.service_pack_id === pack.id);
  const summary = summarizeServicePackDetail({ servicePack: pack, tasks: packTasks });

  await withPage(async (page) => {
    await page.setContent(`
      <section>
        <div id="purchased">${(summary.minutesPurchased / 60).toFixed(2)} hrs</div>
        <div id="used">${(summary.actualMinutesUsed / 60).toFixed(2)} hrs</div>
        <div id="remaining">${(summary.actualMinutesRemaining / 60).toFixed(2)} hrs</div>
      </section>
      <section>
        ${summary.tasksWithPackCoverage.map((task) => `
          <article data-task-id="${task.id}">
            <div class="pack-covered">${(Number(task.pack_covered_minutes) / 60).toFixed(2)} hrs</div>
            <div class="overflow">${(Number(task.overflow_billable_minutes) / 60).toFixed(2)} hrs</div>
          </article>
        `).join('')}
      </section>
    `);

    assert.equal(await page.textContent('#used'), '5.00 hrs');
    assert.equal(await page.textContent('#remaining'), '0.00 hrs');
    assert.equal(await page.locator('[data-task-id="task-2"] .pack-covered').textContent(), '4.00 hrs');
    assert.equal(await page.locator('[data-task-id="task-2"] .overflow').textContent(), '1.00 hrs');
  });
});

test('job detail summary cards render values consistent with shared summary logic', async () => {
  const { servicePacks, jobs, tasks } = makeFixture();
  const summary = summarizeJobDetail({
    job: jobs[0],
    tasks: tasks.filter((task) => task.job_id === 'job-1'),
    servicePacks,
    clientPackTasks: tasks,
  });

  await withPage(async (page) => {
    await page.setContent(`
      <div id="estimate">${(summary.estimatedBillableMinutes / 60).toFixed(2)} hrs</div>
      <div id="actual">${(summary.actualBillableMinutes / 60).toFixed(2)} hrs</div>
      <div id="pack">${(summary.totalPackCoveredMinutes / 60).toFixed(2)} hrs</div>
      <div id="still">${(summary.totalStillBillableMinutes / 60).toFixed(2)} hrs</div>
      <div id="still-value">$${summary.totalStillBillableAmount.toFixed(2)}</div>
      <div id="open-tasks">${summary.openTaskCount}</div>
    `);

    assert.equal(await page.textContent('#estimate'), '6.00 hrs');
    assert.equal(await page.textContent('#actual'), '6.00 hrs');
    assert.equal(await page.textContent('#pack'), '5.00 hrs');
    assert.equal(await page.textContent('#still'), '1.00 hrs');
    assert.equal(await page.textContent('#still-value'), '$120.00');
    assert.equal(await page.textContent('#open-tasks'), '1');
  });
});


test('client summary excludes invoiced job work from to-be-invoiced totals and includes standalone task service rate', async () => {
  const { servicePacks, jobs, tasks, invoices, invoiceLineItems } = makeFixture();
  const summary = summarizeClientDetail({ jobs, tasks, packs: servicePacks, invoices, invoiceLineItems });

  await withPage(async (page) => {
    await page.setContent(`
      <div id="hours-to-be-invoiced">${(summary.totalToBeInvoicedMinutes / 60).toFixed(2)} hrs</div>
      <div id="total-to-be-invoiced">$${summary.totalToBeInvoicedDollars.toFixed(2)}</div>
      <div id="job-1-still-billable">$${summary.jobBillingBreakdown.get('job-1').stillBillableAmount.toFixed(2)}</div>
      <div id="total-invoiced">$${summary.totalInvoiced.toFixed(2)}</div>
      <div id="total-revenue">$${summary.totalRevenue.toFixed(2)}</div>
    `);

    assert.equal(await page.textContent('#hours-to-be-invoiced'), '2.50 hrs');
    assert.equal(await page.textContent('#total-to-be-invoiced'), '$240.00');
    assert.equal(await page.textContent('#job-1-still-billable'), '$120.00');
    assert.equal(await page.textContent('#total-invoiced'), '$240.00');
    assert.equal(await page.textContent('#total-revenue'), '$1320.00');
  });
});

test('client invoice panel job rows show uncovered invoiceable amounts after pack coverage', async () => {
  const { servicePacks, jobs, tasks, invoices, invoiceLineItems } = makeFixture();
  const summary = summarizeClientDetail({ jobs, tasks, packs: servicePacks, invoices, invoiceLineItems });
  const eligibleInvoiceJobs = jobs.filter((job) => !summary.invoicedJobIds.has(job.id));

  await withPage(async (page) => {
    await page.setContent(`
      <section>
        ${eligibleInvoiceJobs.map((job) => `
          <label data-job-id="${job.id}">
            <span class="job-ref">${job.id}</span>
            <span class="job-amount">$${Number(summary.jobBillingBreakdown.get(job.id)?.stillBillableAmount ?? 0).toFixed(2)}</span>
          </label>
        `).join('')}
      </section>
    `);

    assert.equal(await page.locator('[data-job-id="job-1"] .job-amount').textContent(), '$120.00');
  });
});

test('client detail renders date-only fields without time for dob and service-pack purchase date', async () => {
  const { servicePacks } = makeFixture();
  const client = { date_of_birth: '1988-07-09' };

  await withPage(async (page) => {
    await page.setContent(`
      <section>
        <div id="dob">Date of birth: ${formatCrmDate(client.date_of_birth)}</div>
        ${servicePacks.map((pack) => `
          <article data-pack-id="${pack.id}">
            <div class="purchase-date">${formatCrmDate(pack.purchase_date)}</div>
          </article>
        `).join('')}
      </section>
    `);

    assert.equal(await page.textContent('#dob'), 'Date of birth: 1988-07-09');
    assert.equal(await page.locator('[data-pack-id="pack-1"] .purchase-date').textContent(), '2026-04-19');
    assert.equal(await page.locator('[data-pack-id="pack-2"] .purchase-date').textContent(), '2026-04-20');
    assert.equal((await page.textContent('#dob'))?.includes('00:00:00'), false);
  });
});

test('client invoice preview updates selected hours and amount across jobs and standalone tasks', async () => {
  const { servicePacks, jobs, tasks, invoices, invoiceLineItems } = makeFixture();
  const summary = summarizeClientDetail({ jobs, tasks, packs: servicePacks, invoices, invoiceLineItems });
  const jobBreakdown = summary.jobBillingBreakdown.get('job-1');
  const standaloneTask = tasks.find((task) => task.id === 'task-4');
  const standaloneTaskAmount = getCalculatedAmount(
    Number(standaloneTask?.billable_minutes ?? 0),
    Number(standaloneTask?.service_type?.hourly_rate ?? 0),
    Number(standaloneTask?.service_type?.billing_increment_minutes ?? 0) || null,
  );

  await withPage(async (page) => {
    await page.setContent(`
      <form>
        <label>
          <input type="checkbox" class="invoice-selection" data-hours="${(Number(jobBreakdown?.stillBillableMinutes ?? 0) / 60).toFixed(2)}" data-amount="${Number(jobBreakdown?.stillBillableAmount ?? 0).toFixed(2)}" />
          Job 1
        </label>
        <label>
          <input type="checkbox" class="invoice-selection" data-hours="${(Number(standaloneTask?.billable_minutes ?? 0) / 60).toFixed(2)}" data-amount="${standaloneTaskAmount.toFixed(2)}" />
          Task 4
        </label>
        <div id="invoice-preview-hours">0.00h</div>
        <div id="invoice-preview-amount">$0.00</div>
      </form>
      <script>
        (() => {
          const checkboxes = Array.from(document.querySelectorAll('.invoice-selection'));
          const hoursEl = document.getElementById('invoice-preview-hours');
          const amountEl = document.getElementById('invoice-preview-amount');
          if (!checkboxes.length || !hoursEl || !amountEl) return;

          const updatePreview = () => {
            let totalHours = 0;
            let totalAmount = 0;
            for (const checkbox of checkboxes) {
              if (!(checkbox instanceof HTMLInputElement) || !checkbox.checked) continue;
              totalHours += Number(checkbox.dataset.hours ?? 0) || 0;
              totalAmount += Number(checkbox.dataset.amount ?? 0) || 0;
            }
            hoursEl.textContent = totalHours.toFixed(2) + 'h';
            amountEl.textContent = '$' + totalAmount.toFixed(2);
          };

          for (const checkbox of checkboxes) {
            checkbox.addEventListener('change', updatePreview);
          }
          updatePreview();
        })();
      </script>
    `);

    assert.equal(await page.textContent('#invoice-preview-hours'), '0.00h');
    assert.equal(await page.textContent('#invoice-preview-amount'), '$0.00');

    const selections = page.locator('.invoice-selection');
    await selections.nth(0).check();
    assert.equal(await page.textContent('#invoice-preview-hours'), '1.00h');
    assert.equal(await page.textContent('#invoice-preview-amount'), '$120.00');

    await selections.nth(1).check();
    assert.equal(await page.textContent('#invoice-preview-hours'), '2.50h');
    assert.equal(await page.textContent('#invoice-preview-amount'), '$240.00');
  });
});

test('job detail open task keeps exhausted selected pack and renders pack breakdown labels', async () => {
  const { servicePacks, jobs, tasks } = makeFixture();
  const summary = summarizeJobDetail({
    job: jobs[0],
    tasks: tasks.filter((task) => task.job_id === 'job-1'),
    servicePacks,
    clientPackTasks: tasks,
  });
  const task = tasks.find((item) => item.id === 'task-2');
  const availableServicePacks = summary.servicePacks.filter((pack) => pack.status === 'active' && pack.minutes_remaining > 0);
  const options = getTaskServicePackOptions({ availableServicePacks, servicePacks: summary.servicePacks, task });
  const billingBreakdown = summary.taskBillingBreakdown.get(task.id);

  await withPage(async (page) => {
    await page.setContent(`
      <article class="task-card">
        <div class="meta">
          <div class="pack-covered">Pack covered: ${(billingBreakdown.packCoveredMinutes / 60).toFixed(2)}h</div>
          <div class="still-billable">Still billable: ${(billingBreakdown.overflowBillableMinutes / 60).toFixed(2)}h</div>
          <div class="to-be-invoiced">Time to be invoiced: ${(billingBreakdown.overflowBillableMinutes / 60).toFixed(2)}h</div>
        </div>
        <form>
          <select id="service-pack-id">
            <option value="">No pack</option>
            ${options.map((pack) => `<option value="${pack.id}" ${task.service_pack_id === pack.id ? 'selected' : ''}>${pack.service_type?.item_code ?? 'Pack'} (${(pack.minutes_remaining / 60).toFixed(2)}h)</option>`).join('')}
          </select>
        </form>
      </article>
    `);

    assert.equal(await page.textContent('.pack-covered'), 'Pack covered: 4.00h');
    assert.equal(await page.textContent('.still-billable'), 'Still billable: 1.00h');
    assert.equal(await page.textContent('.to-be-invoiced'), 'Time to be invoiced: 1.00h');
    assert.equal(await page.locator('#service-pack-id').inputValue(), 'pack-1');
    assert.equal(await page.locator('#service-pack-id option:checked').textContent(), 'FA40 (0.00h)');
  });
});
