const { Op } = require('sequelize');
const db = require('../models');
const waService = require('./whatsappService');

let timer = null;
let isRunning = false;

function getRecurringIntervalMs(recurring = {}) {
  const value = Number(recurring.interval_value || 0);
  const unit = String(recurring.interval_unit || '').toLowerCase();
  if (!value || value <= 0) return 0;

  if (unit === 'hour') return value * 60 * 60 * 1000;
  if (unit === 'day') return value * 24 * 60 * 60 * 1000;
  if (unit === 'week') return value * 7 * 24 * 60 * 60 * 1000;

  return 0;
}

async function processJob(job) {
  const payload = job.payload || {};

  if (job.type === 'single_send') {
    const result = await waService.sendMessage(
      payload.deviceId,
      payload.phone || '',
      payload.message || '',
      {
        ...(payload.options || {}),
        organizationId: payload.organizationId,
      }
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
    return;
  }

  if (job.type !== 'bulk_send') {
    await job.update({ status: 'failed' });
    return;
  }

  const results = await waService.sendBulkMessages(
    payload.deviceId,
    payload.contacts || [],
    payload.message || '',
    {
      ...(payload.options || {}),
      organizationId: payload.organizationId,
      maxRetries: 3,
    }
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
        const attempts = Number(job.attempts || 1);
        const canRetry = attempts < 3;
        const recurringEnabled = Boolean((job.payload || {}).recurring?.enabled);

        if (recurringEnabled) {
          await job.update({
            status: 'pending',
            run_at: new Date(Date.now() + 60 * 1000),
            attempts: 0,
            payload: {
              ...(job.payload || {}),
              error: error.message,
              failed_at: new Date(),
            },
          });
          continue;
        }

        await job.update({
          status: canRetry ? 'pending' : 'failed',
          run_at: canRetry ? new Date(Date.now() + (attempts * 30 * 1000)) : null,
          payload: {
            ...(job.payload || {}),
            error: error.message,
            failed_at: new Date(),
          },
        });
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
