import {
  allocatePackMinutes,
  deriveServicePacks,
  getCalculatedAmount,
  getPackMinutesPurchased,
} from './crm-metrics.mjs';

function getTaskRateContext(task) {
  return {
    hourlyRate: Number(task?.job?.hourly_rate_snapshot ?? task?.service_type?.hourly_rate ?? 0),
    billingIncrementMinutes: Number(task?.job?.billing_increment_minutes_snapshot ?? task?.service_type?.billing_increment_minutes ?? 0) || null,
  };
}

export function validateClientInvoiceSelection({ selectedJobIds = [], selectedTaskIds = [] }) {
  return selectedJobIds.length === 0 && selectedTaskIds.length === 0
    ? 'Select at least one job or standalone task to include in the invoice.'
    : null;
}

export function buildClientInvoiceLineItems({ invoiceId, selectedJobs = [], selectedTasks = [], summary }) {
  const jobBillingBreakdown = summary?.jobBillingBreakdown ?? new Map();

  return [
    ...selectedJobs.map((job, index) => ({
      invoice_id: invoiceId,
      source_type: 'job',
      job_id: job.id,
      description: `${job.job_reference} · ${job.title}`,
      amount: Number(jobBillingBreakdown.get(job.id)?.stillBillableAmount ?? 0) || 0,
      sort_order: index,
    })),
    ...selectedTasks.map((task, index) => {
      const { hourlyRate, billingIncrementMinutes } = getTaskRateContext(task);
      const billableMinutes = Number(task.billable_minutes ?? 0) || 0;
      return {
        invoice_id: invoiceId,
        source_type: 'task',
        task_id: task.id,
        description: `${task.title}${task.service_type?.name ? ` · ${task.service_type.name}` : ''}`,
        quantity: billableMinutes / 60,
        unit_amount: hourlyRate || null,
        amount: getCalculatedAmount(billableMinutes, hourlyRate, billingIncrementMinutes),
        sort_order: selectedJobs.length + index,
      };
    }),
  ];
}

export function summarizeClientDetail({ jobs = [], tasks = [], packs = [], invoices = [], invoiceLineItems = [] }) {
  const allocation = allocatePackMinutes({ packs, tasks });
  const derivedPacks = deriveServicePacks(packs, tasks);

  const invoicedJobIds = new Set(invoiceLineItems.filter((item) => item.source_type === 'job' && item.job_id).map((item) => item.job_id));
  const invoicedTaskIds = new Set(invoiceLineItems.filter((item) => item.source_type === 'task' && item.task_id).map((item) => item.task_id));

  const totalBillableMinutes = tasks.reduce((sum, task) => sum + (Number(task.billable_minutes ?? 0) || 0), 0);
  const totalPackCoveredMinutes = [...allocation.taskBillingBreakdown.values()].reduce((sum, item) => sum + item.packCoveredMinutes, 0);
  const totalInvoiced = invoices.length > 0
    ? invoices.reduce((sum, invoice) => sum + (Number(invoice.total_amount ?? 0) || 0), 0)
    : jobs.reduce((sum, job) => sum + (job.invoice_number ? Number(job.calculated_billable_amount ?? 0) || 0 : 0), 0);

  const toBeInvoicedTasks = tasks.filter((task) => {
    if (invoicedTaskIds.has(task.id)) return false;
    if (task.job_id && invoicedJobIds.has(task.job_id)) return false;
    if (!invoiceLineItems.length && task.job?.invoice_number) return false;
    return true;
  });
  const totalToBeInvoicedMinutes = toBeInvoicedTasks.reduce((sum, task) => {
    return sum + (Number(allocation.taskBillingBreakdown.get(task.id)?.overflowBillableMinutes ?? task.billable_minutes ?? 0) || 0);
  }, 0);
  const totalToBeInvoicedDollars = toBeInvoicedTasks.reduce((sum, task) => {
    const breakdown = allocation.taskBillingBreakdown.get(task.id) ?? {
      packCoveredMinutes: 0,
      overflowBillableMinutes: Number(task.billable_minutes ?? 0) || 0,
    };
    const { hourlyRate, billingIncrementMinutes } = getTaskRateContext(task);
    return sum + getCalculatedAmount(
      breakdown.overflowBillableMinutes,
      hourlyRate,
      billingIncrementMinutes,
    );
  }, 0);

  const jobBillingBreakdown = new Map(jobs.map((job) => {
    const jobTasks = tasks.filter((task) => task.job_id === job.id);
    const stillBillableMinutes = jobTasks.reduce((sum, task) => {
      return sum + (Number(allocation.taskBillingBreakdown.get(task.id)?.overflowBillableMinutes ?? task.billable_minutes ?? 0) || 0);
    }, 0);
    const stillBillableAmount = getCalculatedAmount(
      stillBillableMinutes,
      Number(job?.hourly_rate_snapshot ?? 0),
      Number(job?.billing_increment_minutes_snapshot ?? 0) || null,
    );

    return [job.id, {
      stillBillableMinutes,
      stillBillableAmount,
    }];
  }));

  const totalServicePackPurchased = packs.reduce((sum, pack) => sum + (Number(pack.purchase_price ?? 0) || 0), 0);
  const totalRevenue = totalInvoiced + totalServicePackPurchased;

  const activeJobs = jobs.filter((job) => !['completed', 'cancelled'].includes(job.status)).length;
  const taskCount = tasks.filter((task) => !['cancelled'].includes(task.status)).length;
  const activePacks = derivedPacks.filter((pack) => pack.status === 'active');
  const totalPackMinutesRemaining = activePacks.reduce((sum, pack) => sum + (Number(pack.minutes_remaining ?? 0) || 0), 0);

  const packCoveredMinutesByPack = new Map();
  for (const task of tasks) {
    if (!task.service_pack_id) continue;
    const breakdown = allocation.taskBillingBreakdown.get(task.id);
    packCoveredMinutesByPack.set(
      task.service_pack_id,
      (packCoveredMinutesByPack.get(task.service_pack_id) ?? 0) + Number(breakdown?.packCoveredMinutes ?? 0),
    );
  }

  const servicePacks = derivedPacks.map((pack) => ({
    ...pack,
    minutes_used: Number(packCoveredMinutesByPack.get(pack.id) ?? 0),
    minutes_remaining: Math.max(0, getPackMinutesPurchased(pack) - Number(packCoveredMinutesByPack.get(pack.id) ?? 0)),
  }));

  return {
    totalBillableMinutes,
    totalPackCoveredMinutes,
    totalToBeInvoicedMinutes,
    totalToBeInvoicedDollars,
    totalInvoiced,
    totalServicePackPurchased,
    totalRevenue,
    activeJobs,
    taskCount,
    totalPackMinutesRemaining,
    servicePacks,
    taskBillingBreakdown: allocation.taskBillingBreakdown,
    jobBillingBreakdown,
    invoicedJobIds,
    invoicedTaskIds,
  };
}

export function summarizeJobDetail({ job, tasks = [], servicePacks = [], clientPackTasks = [] }) {
  const allocation = allocatePackMinutes({ packs: servicePacks, tasks: clientPackTasks });

  const estimatedBillableMinutes = Number(job?.billable_minutes ?? 0) || 0;
  const actualBillableMinutes = tasks.reduce((sum, task) => sum + (Number(task.billable_minutes ?? 0) || 0), 0);
  const actualNonBillableMinutes = tasks.reduce((sum, task) => sum + (Number(task.non_billable_minutes ?? 0) || 0), 0);
  const openTaskCount = tasks.filter((task) => task.status === 'open').length;
  const estimatedBillableAmount = getCalculatedAmount(
    estimatedBillableMinutes,
    Number(job?.hourly_rate_snapshot ?? 0),
    Number(job?.billing_increment_minutes_snapshot ?? 0) || null,
  );
  const actualBillableAmount = getCalculatedAmount(
    actualBillableMinutes,
    Number(job?.hourly_rate_snapshot ?? 0),
    Number(job?.billing_increment_minutes_snapshot ?? 0) || null,
  );
  const totalPackCoveredMinutes = tasks.reduce((sum, task) => sum + (Number(allocation.taskBillingBreakdown.get(task.id)?.packCoveredMinutes ?? 0) || 0), 0);
  const totalStillBillableMinutes = tasks.reduce((sum, task) => sum + (Number(allocation.taskBillingBreakdown.get(task.id)?.overflowBillableMinutes ?? task.billable_minutes ?? 0) || 0), 0);
  const totalStillBillableAmount = getCalculatedAmount(
    totalStillBillableMinutes,
    Number(job?.hourly_rate_snapshot ?? 0),
    Number(job?.billing_increment_minutes_snapshot ?? 0) || null,
  );

  const derivedServicePacks = deriveServicePacks(servicePacks, clientPackTasks);

  return {
    estimatedBillableMinutes,
    actualBillableMinutes,
    actualNonBillableMinutes,
    openTaskCount,
    estimatedBillableAmount,
    actualBillableAmount,
    totalPackCoveredMinutes,
    totalStillBillableMinutes,
    totalStillBillableAmount,
    taskBillingBreakdown: allocation.taskBillingBreakdown,
    servicePacks: derivedServicePacks,
  };
}

export function formatCrmTimestamp(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (!text) return '';

  const direct = text.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}:\d{2})/);
  if (direct) return `${direct[1]} ${direct[2]}`;

  const dateOnly = text.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) return `${dateOnly[1]} 00:00:00`;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  const seconds = String(parsed.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function summarizeServicePackDetail({ servicePack, tasks = [] }) {
  const minutesPurchased = getPackMinutesPurchased(servicePack);
  const allocation = allocatePackMinutes({ packs: [servicePack], tasks });

  const tasksWithPackCoverage = tasks.map((task) => {
    const breakdown = allocation.taskBillingBreakdown.get(task.id) ?? {
      packCoveredMinutes: 0,
      overflowBillableMinutes: Number(task.billable_minutes ?? 0) || 0,
    };
    return {
      ...task,
      pack_covered_minutes: breakdown.packCoveredMinutes,
      overflow_billable_minutes: breakdown.overflowBillableMinutes,
    };
  });

  const actualMinutesUsed = tasksWithPackCoverage.reduce((sum, task) => sum + (Number(task.pack_covered_minutes ?? 0) || 0), 0);
  const actualMinutesRemaining = Math.max(0, minutesPurchased - actualMinutesUsed);

  return {
    minutesPurchased,
    actualMinutesUsed,
    actualMinutesRemaining,
    tasksWithPackCoverage,
  };
}
