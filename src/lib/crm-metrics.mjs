export function roundBillableMinutes(minutes, increment) {
  if (!increment || increment <= 0) return Number(minutes ?? 0) || 0;
  return Math.ceil((Number(minutes ?? 0) || 0) / increment) * increment;
}

export function getCalculatedAmount(minutes, hourlyRate, increment = null) {
  const safeMinutes = Number(minutes ?? 0) || 0;
  const safeRate = Number(hourlyRate ?? 0) || 0;
  if (safeMinutes <= 0 || safeRate <= 0) return 0;
  const roundedMinutes = roundBillableMinutes(safeMinutes, increment);
  return (roundedMinutes / 60) * safeRate;
}

export function getPackMinutesPurchased(pack) {
  return Number(pack?.minutes_purchased ?? 0) || Math.round((Number(pack?.hours_purchased ?? 0) || 0) * 60);
}

export function sortTasksForPackAllocation(tasks = []) {
  return [...tasks].sort((a, b) => {
    const aTime = new Date(a?.completed_at ?? a?.due_at ?? 0).getTime();
    const bTime = new Date(b?.completed_at ?? b?.due_at ?? 0).getTime();
    return aTime - bTime;
  });
}

export function allocatePackMinutes({ packs = [], tasks = [] }) {
  const purchasedMinutesByPack = new Map(packs.map((pack) => [pack.id, getPackMinutesPurchased(pack)]));
  const remainingMinutesByPack = new Map(purchasedMinutesByPack);
  const taskBillingBreakdown = new Map();

  for (const task of sortTasksForPackAllocation(tasks)) {
    const billableMinutes = Number(task?.billable_minutes ?? 0) || 0;
    const packId = task?.service_pack_id ?? null;

    if (!packId || billableMinutes <= 0) {
      taskBillingBreakdown.set(task.id, {
        packCoveredMinutes: 0,
        overflowBillableMinutes: billableMinutes,
      });
      continue;
    }

    const remaining = Number(remainingMinutesByPack.get(packId) ?? 0);
    const packCoveredMinutes = Math.min(billableMinutes, Math.max(0, remaining));
    const overflowBillableMinutes = Math.max(0, billableMinutes - packCoveredMinutes);

    remainingMinutesByPack.set(packId, Math.max(0, remaining - packCoveredMinutes));
    taskBillingBreakdown.set(task.id, {
      packCoveredMinutes,
      overflowBillableMinutes,
    });
  }

  const usedMinutesByPack = new Map();
  for (const [packId, purchased] of purchasedMinutesByPack.entries()) {
    usedMinutesByPack.set(packId, purchased - Number(remainingMinutesByPack.get(packId) ?? 0));
  }

  return {
    purchasedMinutesByPack,
    remainingMinutesByPack,
    usedMinutesByPack,
    taskBillingBreakdown,
  };
}

export function deriveServicePacks(packs = [], tasks = []) {
  const allocation = allocatePackMinutes({ packs, tasks });
  return packs.map((pack) => {
    const minutesPurchased = getPackMinutesPurchased(pack);
    const minutesUsed = Number(allocation.usedMinutesByPack.get(pack.id) ?? 0);
    const baseStatus = pack.status ?? 'active';
    const status = minutesUsed >= minutesPurchased
      ? 'used_up'
      : baseStatus === 'cancelled' || baseStatus === 'expired'
        ? baseStatus
        : 'active';

    return {
      ...pack,
      minutes_purchased: minutesPurchased,
      minutes_used: minutesUsed,
      minutes_remaining: Math.max(0, minutesPurchased - minutesUsed),
      status,
    };
  });
}

export function summarizeClientDirectory({ clients = [], jobs = [], tasks = [], packs = [] }) {
  const allocation = allocatePackMinutes({ packs, tasks });
  const jobsByClient = new Map();
  const billableDollarsByJob = new Map();
  const openTasksByClient = new Map();

  for (const job of jobs) {
    const current = jobsByClient.get(job.client_id) ?? { totalBillableHours: 0, totalBillableDollars: 0, totalInvoiced: 0, openJobs: 0 };
    if (!['completed', 'cancelled'].includes(job.status)) current.openJobs += 1;
    jobsByClient.set(job.client_id, current);
  }

  for (const task of tasks) {
    const current = jobsByClient.get(task.client_id) ?? { totalBillableHours: 0, totalBillableDollars: 0, totalInvoiced: 0, openJobs: 0 };
    const breakdown = allocation.taskBillingBreakdown.get(task.id) ?? { packCoveredMinutes: 0, overflowBillableMinutes: Number(task.billable_minutes ?? 0) || 0 };
    const stillBillableMinutes = breakdown.overflowBillableMinutes;
    const taskDollars = getCalculatedAmount(
      stillBillableMinutes,
      Number(task.job?.hourly_rate_snapshot ?? 0),
      Number(task.job?.billing_increment_minutes_snapshot ?? 0) || null,
    );

    current.totalBillableHours += stillBillableMinutes / 60;
    current.totalBillableDollars += taskDollars;

    if (task.job_id) {
      billableDollarsByJob.set(task.job_id, (billableDollarsByJob.get(task.job_id) ?? 0) + taskDollars);
    }

    if (!['done', 'cancelled'].includes(task.status)) {
      openTasksByClient.set(task.client_id, (openTasksByClient.get(task.client_id) ?? 0) + 1);
    }

    jobsByClient.set(task.client_id, current);
  }

  for (const job of jobs) {
    const current = jobsByClient.get(job.client_id) ?? { totalBillableHours: 0, totalBillableDollars: 0, totalInvoiced: 0, openJobs: 0 };
    if (job.invoice_status && !['not_invoiced', 'void'].includes(job.invoice_status)) {
      current.totalInvoiced += billableDollarsByJob.get(job.id) ?? 0;
    }
    jobsByClient.set(job.client_id, current);
  }

  const derivedPacks = deriveServicePacks(packs, tasks);
  const activePacksByClient = new Map();
  for (const pack of derivedPacks) {
    if (pack.status === 'active' && pack.minutes_remaining > 0) {
      activePacksByClient.set(pack.client_id, (activePacksByClient.get(pack.client_id) ?? 0) + 1);
    }
  }

  return clients.map((client) => {
    const billing = jobsByClient.get(client.id) ?? { totalBillableHours: 0, totalBillableDollars: 0, totalInvoiced: 0, openJobs: 0 };
    return {
      ...client,
      total_billable_hours: billing.totalBillableHours,
      total_billable_dollars: billing.totalBillableDollars,
      total_invoiced: billing.totalInvoiced,
      active_service_packs: activePacksByClient.get(client.id) ?? 0,
      open_jobs: billing.openJobs,
      open_tasks: openTasksByClient.get(client.id) ?? 0,
    };
  });
}

export function summarizeJobsIndex({ jobs = [], tasks = [], packs = [] }) {
  const allocation = allocatePackMinutes({ packs, tasks });
  const usageCounts = new Map();
  const openTaskCounts = new Map();
  const stillBillableMinutesByJob = new Map();

  for (const task of tasks) {
    const breakdown = allocation.taskBillingBreakdown.get(task.id) ?? { packCoveredMinutes: 0, overflowBillableMinutes: Number(task.billable_minutes ?? 0) || 0 };
    if (breakdown.packCoveredMinutes > 0) {
      usageCounts.set(task.job_id, (usageCounts.get(task.job_id) ?? 0) + 1);
    }
    stillBillableMinutesByJob.set(task.job_id, (stillBillableMinutesByJob.get(task.job_id) ?? 0) + breakdown.overflowBillableMinutes);
    if (!['done', 'cancelled'].includes(task.status)) {
      openTaskCounts.set(task.job_id, (openTaskCounts.get(task.job_id) ?? 0) + 1);
    }
  }

  return jobs.map((job) => ({
    ...job,
    billable_minutes: Number(job.billable_minutes ?? 0) || 0,
    calculated_billable_amount: getCalculatedAmount(
      Number(stillBillableMinutesByJob.get(job.id) ?? 0),
      Number(job.hourly_rate_snapshot ?? 0),
      Number(job.billing_increment_minutes_snapshot ?? 0) || null,
    ),
    service_pack_usage_count: usageCounts.get(job.id) ?? 0,
    open_task_count: openTaskCounts.get(job.id) ?? 0,
  }));
}

export function getTaskServicePackOptions({ availableServicePacks = [], servicePacks = [], task }) {
  const availableById = new Map(availableServicePacks.map((pack) => [pack.id, pack]));
  const options = [...availableServicePacks];

  if (task?.service_pack_id && !availableById.has(task.service_pack_id)) {
    const selectedPack = servicePacks.find((pack) => pack.id === task.service_pack_id);
    if (selectedPack) options.unshift(selectedPack);
  }

  return options;
}
