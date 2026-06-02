const { Op } = require('sequelize');
const db = require('../models');
const waService = require('./whatsappService');

let timer = null;
let isRunning = false;

const MAX_JOB_ATTEMPTS = Number(process.env.JOB_MAX_ATTEMPTS || 4);
const BASE_RETRY_DELAY_MS = Number(process.env.JOB_RETRY_BASE_DELAY_MS || 30 * 1000);
const MAX_RETRY_DELAY_MS = Number(process.env.JOB_RETRY_MAX_DELAY_MS || 15 * 60 * 1000);

function normalizeJobPayload(rawPayload) {
  let payload = rawPayload;

  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (_error) {
      payload = {};
    }
  }

  if (!payload || typeof payload !== 'object') {
    payload = {};
  }

  const organizationId = payload.organizationId ?? payload.organization_id ?? null;
  const deviceId = payload.deviceId ?? payload.device_id ?? null;

  return {
    ...payload,
    organizationId: organizationId == null ? null : String(organizationId),
    deviceId: deviceId == null ? null : String(deviceId),
  };
}

function getRecurringIntervalMs(recurring = {}) {
  const value = Number(recurring.interval_value || 0);
  const unit = String(recurring.interval_unit || '').toLowerCase();
  if (!value || value <= 0) return 0;

  if (unit === 'hour') return value * 60 * 60 * 1000;
  if (unit === 'day') return value * 24 * 60 * 60 * 1000;
  if (unit === 'week') return value * 7 * 24 * 60 * 60 * 1000;

  return 0;
}

function computeRetryDelayMs(attempts) {
  return Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * (2 ** Math.max(0, attempts - 1)));
}

async function processSingleSend(job, payload) {
  const phone = payload.phone || '';
  const result = await waService.sendMessage(
    payload.deviceId,
    phone,
    payload.message || '',
    {
      ...(payload.options || {}),
      organizationId: payload.organizationId,
      idempotencyKey: payload.options?.idempotencyKey || `job:${job.id}:single:${phone}`,
    },
  );

  const recurring = payload.recurring || {};
  if (recurring.enabled) {
    const intervalMs = getRecurringIntervalMs(recurring);
    const nextRunAt = intervalMs > 0 ? new Date(Date.now() + intervalMs) : null;

    if (!nextRunAt) {
      await job.update({
        status: 'failed',
        payload: {
          ...payload,
          error: 'Invalid recurring interval configuration',
          failed_at: new Date(),
        },
      });
      return;
    }

    await job.update({
      status: 'pending',
      attempts: 0,
      run_at: nextRunAt,
      payload: {
        ...payload,
        last_result: {
          status: 'sent',
          to: result.to,
          id: result.id,
          timestamp: result.timestamp,
        },
        last_run_at: new Date(),
      },
    });
    return;
  }

  await job.update({
    status: 'completed',
    payload: {
      ...payload,
      result: {
        status: 'sent',
        to: result.to,
        id: result.id,
        timestamp: result.timestamp,
      },
      completed_at: new Date(),
    },
  });
}

async function processBulkSend(job, payload) {
  const results = await waService.sendBulkMessages(
    payload.deviceId,
    payload.contacts || [],
    payload.message || '',
    {
      ...(payload.options || {}),
      organizationId: payload.organizationId,
      maxRetries: Number(payload.options?.maxRetries || 3),
      idempotencyKey: payload.options?.idempotencyKey || `job:${job.id}:bulk`,
    },
  );

  const sent = results.filter((r) => r.status === 'sent').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  await job.update({
    status: 'completed',
    payload: {
      ...payload,
      result: {
        total: results.length,
        sent,
        failed,
      },
      completed_at: new Date(),
    },
  });
}

async function processJob(job) {
  const payload = normalizeJobPayload(job.payload);

  if (job.type === 'single_send') {
    await processSingleSend(job, payload);
    return;
  }

  if (job.type === 'bulk_send') {
    await processBulkSend(job, payload);
    return;
  }

  await job.update({ status: 'failed' });
}

async function handleJobError(job, error) {
  const attempts = Number(job.attempts || 1);
  const canRetry = attempts < MAX_JOB_ATTEMPTS;
  const currentPayload = normalizeJobPayload(job.payload);
  const recurringEnabled = Boolean((currentPayload.recurring || {}).enabled);

  if (recurringEnabled) {
    await job.update({
      status: 'pending',
      run_at: new Date(Date.now() + 60 * 1000),
      attempts: 0,
      payload: {
        ...currentPayload,
        error: error.message,
        failed_at: new Date(),
      },
    });
    return;
  }

  const retryDelayMs = computeRetryDelayMs(attempts);

  await job.update({
    status: canRetry ? 'pending' : 'failed',
    run_at: canRetry ? new Date(Date.now() + retryDelayMs) : null,
    payload: {
      ...currentPayload,
      error: error.message,
      failed_at: new Date(),
      retry_delay_ms: canRetry ? retryDelayMs : null,
    },
  });
}

async function tick() {
  if (isRunning) return;
  isRunning = true;

  try {
    const pendingJobs = await db.Job.findAll({
      where: {
        status: 'pending',
        [Op.or]: [{ run_at: null }, { run_at: { [Op.lte]: new Date() } }],
      },
      order: [['id', 'ASC']],
      limit: 3,
    });

    for (const job of pendingJobs) {
      try {
        await job.update({ status: 'processing', attempts: Number(job.attempts || 0) + 1 });
        await processJob(job);
      } catch (error) {
        await handleJobError(job, error);
      }
    }
  } catch (error) {
    console.error('[JobWorker] tick failed:', error.message);
  } finally {
    isRunning = false;
  }
}

function startJobWorker(intervalMs = 5000) {
  if (timer) return;

  timer = setInterval(tick, intervalMs);
  timer.unref();
  tick().catch((error) => {
    console.error('[JobWorker] initial tick failed:', error.message);
  });

  console.log(`[JobWorker] started (interval=${intervalMs}ms)`);
}

function stopJobWorker() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  console.log('[JobWorker] stopped');
}

module.exports = {
  startJobWorker,
  stopJobWorker,
};
