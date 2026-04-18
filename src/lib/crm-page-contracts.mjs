import {
  allocatePackMinutes,
  deriveServicePacks,
  getCalculatedAmount,
  getPackMinutesPurchased,
} from './crm-metrics.mjs';

export function summarizeClientDetail({ jobs = [], tasks = [], packs = [] }) {
  const allocation = allocatePackMinutes({ packs, tasks });
  const derivedPacks = deriveServicePacks(packs, tasks);

  const totalBillableMinutes = tasks.reduce((sum, task) => sum + (Number(task.billable_minutes ?? 0) || 0), 0);
  const totalPackCoveredMinutes = [...allocation.taskBillingBreakdown.values()].reduce((sum, item) => sum + item.packCoveredMinutes, 0);
  const totalStillBillableMinutes = [...allocation.taskBillingBreakdown.values()].reduce((sum, item) => sum + item.overflowBillableMinutes, 0);
  const totalBillableDollars = tasks.reduce((sum, task) => {
    const breakdown = allocation.taskBillingBreakdown.get(task.id) ?? {
      packCoveredMinutes: 0,
      overflowBillableMinutes: Number(task.billable_minutes ?? 0) || 0,
    };
    return sum + getCalculatedAmount(
      breakdown.overflowBillableMinutes,
      Number(task.job?.hourly_rate_snapshot ?? 0),
      Number(task.job?.billing_increment_minutes_snapshot ?? 0) || null,
    );
  }, 0);

  const totalInvoiced = jobs.reduce((sum, job) => {
    return sum + (job.invoice_number ? Number(job.calculated_billable_amount ?? 0) || 0 : 0);
  }, 0);

  const activeJobs = jobs.filter((job) => !['completed', 'cancelled'].includes(job.status)).length;
  const openTasks = tasks.filter((task) => !['done', 'cancelled'].includes(task.status)).length;
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
    totalStillBillableMinutes,
    totalBillableDollars,
    totalInvoiced,
    activeJobs,
    openTasks,
    totalPackMinutesRemaining,
    servicePacks,
    taskBillingBreakdown: allocation.taskBillingBreakdown,
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
