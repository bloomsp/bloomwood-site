import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

import { getTaskServicePackOptions } from '../src/lib/crm-metrics.mjs';
import {
  summarizeClientDetail,
  summarizeJobDetail,
  summarizeServicePackDetail,
} from '../src/lib/crm-page-contracts.mjs';

function makeFixture() {
  const servicePacks = [
    { id: 'pack-1', client_id: 'client-1', hours_purchased: 5, minutes_purchased: 300, status: 'active', service_type: { item_code: 'FA40', name: 'Five Hour Pack' } },
    { id: 'pack-2', client_id: 'client-1', hours_purchased: 2, minutes_purchased: 120, status: 'active', service_type: { item_code: 'IT100', name: 'Two Hour Pack' } },
  ];

  const jobs = [
    { id: 'job-1', client_id: 'client-1', status: 'in_progress', billable_minutes: 360, calculated_billable_amount: 720, hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15, invoice_number: null },
    { id: 'job-2', client_id: 'client-1', status: 'completed', billable_minutes: 120, calculated_billable_amount: 240, hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15, invoice_number: 'INV-001' },
  ];

  const tasks = [
    { id: 'task-1', client_id: 'client-1', job_id: 'job-1', title: 'aaa', status: 'done', billable_minutes: 60, non_billable_minutes: 0, service_pack_id: 'pack-1', completed_at: '2026-04-18T09:00:00.000Z', job: { hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15 } },
    { id: 'task-2', client_id: 'client-1', job_id: 'job-1', title: 'www', status: 'open', billable_minutes: 300, non_billable_minutes: 30, service_pack_id: 'pack-1', completed_at: '2026-04-18T10:00:00.000Z', job: { hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15 } },
    { id: 'task-3', client_id: 'client-1', job_id: 'job-2', title: 'bbb', status: 'done', billable_minutes: 120, non_billable_minutes: 0, service_pack_id: null, completed_at: '2026-04-18T11:00:00.000Z', job: { hourly_rate_snapshot: 120, billing_increment_minutes_snapshot: 15 } },
  ];

  return { servicePacks, jobs, tasks };
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
