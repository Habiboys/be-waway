const { Op } = require('sequelize');
const { Subscription, Plan, UsageLog, sequelize } = require('../models');

function addMonths(date, months) {
  const source = new Date(date);
  const day = source.getDate();
  const result = new Date(source);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function toDateOnlyString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentCycleBounds(subscription, now = new Date()) {
  const anchor = new Date(subscription.start_date);
  const cycleDay = anchor.getDate();

  let cycleStart = new Date(now.getFullYear(), now.getMonth(), cycleDay);
  if (cycleStart > now) {
    cycleStart = addMonths(cycleStart, -1);
  }

  cycleStart.setHours(anchor.getHours(), anchor.getMinutes(), anchor.getSeconds(), anchor.getMilliseconds());

  let cycleEnd = addMonths(cycleStart, 1);
  cycleEnd = new Date(cycleEnd.getTime() - 1);

  return { cycleStart, cycleEnd };
}

async function getActiveSubscription(organizationId) {
  return Subscription.findOne({
    where: {
      organization_id: organizationId,
      status: 'active',
      end_date: { [Op.gte]: new Date() },
    },
    include: [{ model: Plan, as: 'plan' }],
    order: [['end_date', 'DESC']],
  });
}

async function getUsedInCycle(organizationId, cycleStart, cycleEnd) {
  const used = await UsageLog.sum('messages_sent', {
    where: {
      organization_id: organizationId,
      date: {
        [Op.gte]: toDateOnlyString(cycleStart),
        [Op.lte]: toDateOnlyString(cycleEnd),
      },
    },
  });

  return Number(used || 0);
}

async function getOtpUsedInCycle(organizationId, cycleStart, cycleEnd) {
  const used = await UsageLog.sum('otp_sent', {
    where: {
      organization_id: organizationId,
      date: {
        [Op.gte]: toDateOnlyString(cycleStart),
        [Op.lte]: toDateOnlyString(cycleEnd),
      },
    },
  });

  return Number(used || 0);
}

// ─── Message Quota ──────────────────────────────────────────────────

async function checkQuota(organizationId) {
  const subscription = await getActiveSubscription(organizationId);

  if (!subscription || !subscription.plan) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      used: 0,
      hasActiveSubscription: false,
      message: 'No active subscription',
    };
  }

  const { cycleStart, cycleEnd } = getCurrentCycleBounds(subscription);
  const used = await getUsedInCycle(organizationId, cycleStart, cycleEnd);
  const limit = Number(subscription.plan.message_limit || 0);
  const remaining = Math.max(0, limit - used);

  return {
    allowed: remaining > 0,
    remaining,
    limit,
    used,
    hasActiveSubscription: true,
    plan: {
      id: subscription.plan.id,
      name: subscription.plan.name,
      duration_days: subscription.plan.duration_days,
    },
    cycle_start: cycleStart,
    cycle_end: cycleEnd,
    subscription: {
      id: subscription.id,
      start_date: subscription.start_date,
      end_date: subscription.end_date,
      status: subscription.status,
    },
  };
}

async function consumeQuota(organizationId, count = 1, options = {}) {
  const qty = Math.max(0, Number(count) || 0);
  if (!qty) {
    return checkQuota(organizationId);
  }

  if (!options.skipCheck) {
    const quota = await checkQuota(organizationId);
    if (!quota.allowed || quota.remaining < qty) {
      const error = new Error('Quota exceeded');
      error.statusCode = 403;
      error.quota = quota;
      throw error;
    }
  }

  const usageDate = toDateOnlyString(options.referenceDate || new Date());

  await sequelize.transaction(async (transaction) => {
    const [row] = await UsageLog.findOrCreate({
      where: {
        organization_id: organizationId,
        date: usageDate,
      },
      defaults: {
        organization_id: organizationId,
        date: usageDate,
        messages_sent: 0,
        otp_sent: 0,
      },
      transaction,
    });

    await row.increment('messages_sent', { by: qty, transaction });
  });

  return checkQuota(organizationId);
}

// ─── OTP Quota ──────────────────────────────────────────────────────

async function checkOtpQuota(organizationId) {
  const subscription = await getActiveSubscription(organizationId);

  if (!subscription || !subscription.plan) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      used: 0,
      hasActiveSubscription: false,
      message: 'No active subscription',
    };
  }

  const otpLimit = Number(subscription.plan.otp_limit || 0);

  // otp_limit = 0 means OTP not included in plan
  if (otpLimit === 0) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      used: 0,
      hasActiveSubscription: true,
      message: 'OTP not included in your plan. Please upgrade.',
    };
  }

  const { cycleStart, cycleEnd } = getCurrentCycleBounds(subscription);
  const used = await getOtpUsedInCycle(organizationId, cycleStart, cycleEnd);

  // otp_limit = -1 means unlimited
  if (otpLimit < 0) {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      used,
      hasActiveSubscription: true,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
      },
      cycle_start: cycleStart,
      cycle_end: cycleEnd,
    };
  }

  const remaining = Math.max(0, otpLimit - used);

  return {
    allowed: remaining > 0,
    remaining,
    limit: otpLimit,
    used,
    hasActiveSubscription: true,
    plan: {
      id: subscription.plan.id,
      name: subscription.plan.name,
    },
    cycle_start: cycleStart,
    cycle_end: cycleEnd,
  };
}

async function consumeOtpQuota(organizationId, count = 1, options = {}) {
  const qty = Math.max(0, Number(count) || 0);
  if (!qty) {
    return checkOtpQuota(organizationId);
  }

  if (!options.skipCheck) {
    const quota = await checkOtpQuota(organizationId);
    if (!quota.allowed) {
      const error = new Error(quota.message || 'OTP quota exceeded');
      error.statusCode = 403;
      error.quota = quota;
      throw error;
    }
    // -1 means unlimited, skip remaining check
    if (quota.remaining !== -1 && quota.remaining < qty) {
      const error = new Error('OTP quota exceeded');
      error.statusCode = 403;
      error.quota = quota;
      throw error;
    }
  }

  const usageDate = toDateOnlyString(options.referenceDate || new Date());

  await sequelize.transaction(async (transaction) => {
    const [row] = await UsageLog.findOrCreate({
      where: {
        organization_id: organizationId,
        date: usageDate,
      },
      defaults: {
        organization_id: organizationId,
        date: usageDate,
        messages_sent: 0,
        otp_sent: 0,
      },
      transaction,
    });

    await row.increment('otp_sent', { by: qty, transaction });
  });

  return checkOtpQuota(organizationId);
}

// ─── Summary ────────────────────────────────────────────────────────

async function getUsageSummary(organizationId) {
  const quota = await checkQuota(organizationId);
  const otpQuota = await checkOtpQuota(organizationId);
  const today = toDateOnlyString(new Date());
  const todayUsage = await UsageLog.findOne({
    where: { organization_id: organizationId, date: today },
  });

  const usedToday = Number(todayUsage?.messages_sent || 0);
  const otpUsedToday = Number(todayUsage?.otp_sent || 0);
  const usagePercent = quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;
  const otpUsagePercent = otpQuota.limit > 0 ? Math.min(100, Math.round((otpQuota.used / otpQuota.limit) * 100)) : 0;

  return {
    ...quota,
    used_today: usedToday,
    usage_percent: usagePercent,
    otp: {
      ...otpQuota,
      used_today: otpUsedToday,
      usage_percent: otpUsagePercent,
    },
  };
}

module.exports = {
  checkQuota,
  consumeQuota,
  checkOtpQuota,
  consumeOtpQuota,
  getUsageSummary,
  getActiveSubscription,
};
