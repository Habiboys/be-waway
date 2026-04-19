const buildCrudController = require('./crudFactory');
const asyncHandler = require('../utils/asyncHandler');
const { Op } = require('sequelize');
const waService = require('../services/whatsappService');
const quotaService = require('../services/quotaService');
const db = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const controller = buildCrudController({ modelName: 'Device', label: 'Device' });

const getOwnedDevice = async (id, organizationId) => {
  return db.Device.findOne({ where: { id, organization_id: organizationId } });
};

const SCHEDULE_JOB_STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled'];

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
    organizationId: organizationId == null ? null : Number(organizationId),
    deviceId: deviceId == null ? null : Number(deviceId),
  };
}

function isScheduleOwnedByContext(job, organizationId, deviceId) {
  const payload = normalizeJobPayload(job?.payload);
  return Number(payload.organizationId) === Number(organizationId)
    && Number(payload.deviceId) === Number(deviceId);
}

function serializeScheduledJob(job) {
  const payload = normalizeJobPayload(job.payload);
  return {
    id: job.id,
    status: job.status,
    run_at: job.run_at,
    created_at: job.created_at,
    attempts: job.attempts,
    phone: payload.phone || null,
    message: payload.message || '',
    recurring: payload.recurring || { enabled: false },
    last_result: payload.last_result || payload.result || null,
    last_run_at: payload.last_run_at || null,
    error: payload.error || null,
  };
}

// --- Upload middleware for Excel files ---
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel/CSV files are allowed'), false);
    }
  },
});

controller.uploadMiddleware = upload.single('file');

// --- Connect device: start WA client ---
controller.connect = asyncHandler(async (req, res) => {
  const device = await db.Device.findOne({
    where: { id: req.params.id, organization_id: req.organizationId },
  });
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }

  try {
    const status = await waService.initClient(device.id, device);
    await device.update({ status: status.status === 'ready' ? 'online' : 'connecting' });
    res.json({ device_id: device.id, ...status });
  } catch (err) {
    res.status(500).json({ message: 'Failed to connect device', error: err.message });
  }
});

// --- Disconnect device ---
controller.disconnect = asyncHandler(async (req, res) => {
  const device = await db.Device.findOne({
    where: { id: req.params.id, organization_id: req.organizationId },
  });
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }

  await waService.disconnectClient(device.id);
  await device.update({ status: 'offline', last_seen: new Date() });

  res.json({ device_id: device.id, status: 'disconnected' });
});

// --- Get QR code ---
controller.qr = asyncHandler(async (req, res) => {
  const status = waService.getStatus(req.params.id);
  res.json({
    device_id: req.params.id,
    qr: status.qr || null,
    status: status.status,
  });
});

// --- Get real-time status ---
controller.status = asyncHandler(async (req, res) => {
  const status = waService.getStatus(req.params.id);
  res.json({
    device_id: req.params.id,
    ...status,
    // Remove raw QR from status response (use /qr endpoint)
    qrRaw: undefined,
  });
});

// --- Get all device statuses ---
controller.allStatuses = asyncHandler(async (req, res) => {
  const statuses = waService.getAllStatuses();
  res.json(statuses);
});

// --- Send test message ---
controller.sendTest = asyncHandler(async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ message: 'phone and message are required' });
  }

  const device = await getOwnedDevice(req.params.id, req.organizationId);
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }

  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin) {
    const quota = await quotaService.checkQuota(req.organizationId);
    if (!quota.hasActiveSubscription || !quota.allowed) {
      return res.status(403).json({
        message: !quota.hasActiveSubscription
          ? 'Subscription is required before sending messages'
          : 'Quota exhausted. Please upgrade your plan.',
        quota,
      });
    }
  }

  try {
    const result = await waService.sendMessage(req.params.id, phone, message, {
      organizationId: req.organizationId,
      bypassQuota: isAdmin,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// --- Schedule single message ---
controller.scheduleSend = asyncHandler(async (req, res) => {
  const {
    phone,
    message,
    schedule_type,
    run_at,
    interval_value,
    interval_unit,
  } = req.body || {};

  if (!phone || !message) {
    return res.status(400).json({ message: 'phone and message are required' });
  }

  const device = await getOwnedDevice(req.params.id, req.organizationId);
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }

  const type = String(schedule_type || 'once').toLowerCase();
  const isAdmin = req.user?.role === 'admin';
  const now = new Date();

  let firstRunAt = run_at ? new Date(run_at) : new Date();
  if (Number.isNaN(firstRunAt.getTime())) {
    return res.status(400).json({ message: 'Invalid run_at format' });
  }
  if (firstRunAt < now) {
    firstRunAt = now;
  }

  const recurring = { enabled: false };

  if (type === 'hourly' || type === 'daily' || type === 'weekly') {
    recurring.enabled = true;
    recurring.interval_value = 1;
    recurring.interval_unit = type === 'hourly' ? 'hour' : type === 'daily' ? 'day' : 'week';
  } else if (type === 'custom') {
    const value = Number(interval_value || 0);
    const unit = String(interval_unit || '').toLowerCase();
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ message: 'interval_value must be greater than 0 for custom schedule' });
    }
    if (!['hour', 'day', 'week'].includes(unit)) {
      return res.status(400).json({ message: 'interval_unit must be one of: hour, day, week' });
    }

    recurring.enabled = true;
    recurring.interval_value = value;
    recurring.interval_unit = unit;
  } else if (type !== 'once') {
    return res.status(400).json({
      message: 'schedule_type must be one of: once, hourly, daily, weekly, custom',
    });
  }

  const job = await db.Job.create({
    type: 'single_send',
    payload: {
      organizationId: req.organizationId,
      deviceId: Number(req.params.id),
      phone: String(phone).trim(),
      message: String(message),
      options: {
        bypassQuota: isAdmin,
      },
      recurring,
      source: 'api:scheduleSend',
      created_by: req.user.id,
    },
    status: 'pending',
    attempts: 0,
    run_at: firstRunAt,
  });

  return res.json({
    success: true,
    message: recurring.enabled ? 'Recurring schedule created' : 'Scheduled message created',
    job_id: job.id,
    job_status: job.status,
    run_at: job.run_at,
    recurring,
  });
});

// --- List scheduled messages by device ---
controller.listSchedules = asyncHandler(async (req, res) => {
  const device = await getOwnedDevice(req.params.id, req.organizationId);
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }

  const rows = await db.Job.findAll({
    where: {
      type: 'single_send',
      status: { [Op.in]: SCHEDULE_JOB_STATUSES },
    },
    order: [['id', 'DESC']],
    limit: 300,
  });

  const filtered = rows.filter((job) =>
    isScheduleOwnedByContext(job, req.organizationId, req.params.id)
  );

  return res.json(filtered.map(serializeScheduledJob));
});

// --- Stop/cancel scheduled message ---
controller.stopSchedule = asyncHandler(async (req, res) => {
  const device = await getOwnedDevice(req.params.id, req.organizationId);
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }

  const job = await db.Job.findByPk(req.params.jobId);
  if (!job || job.type !== 'single_send') {
    return res.status(404).json({ message: 'Scheduled message not found' });
  }

  if (!isScheduleOwnedByContext(job, req.organizationId, req.params.id)) {
    return res.status(403).json({ message: 'You do not have access to this schedule' });
  }

  if (job.status === 'processing') {
    return res.status(409).json({ message: 'Schedule is currently processing and cannot be stopped' });
  }

  const payload = job.payload || {};
  await job.update({
    status: 'cancelled',
    payload: {
      ...payload,
      recurring: { ...(payload.recurring || {}), enabled: false },
      cancelled_at: new Date(),
      cancelled_by: req.user?.id || null,
    },
  });

  return res.json(serializeScheduledJob(job));
});

// --- Resume recurring schedule ---
controller.resumeSchedule = asyncHandler(async (req, res) => {
  const device = await getOwnedDevice(req.params.id, req.organizationId);
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }

  const job = await db.Job.findByPk(req.params.jobId);
  if (!job || job.type !== 'single_send') {
    return res.status(404).json({ message: 'Scheduled message not found' });
  }

  if (!isScheduleOwnedByContext(job, req.organizationId, req.params.id)) {
    return res.status(403).json({ message: 'You do not have access to this schedule' });
  }

  const payload = job.payload || {};
  const recurring = payload.recurring || {};

  if (!recurring.enabled && !recurring.interval_unit) {
    return res.status(400).json({ message: 'This schedule is not recurring' });
  }

  await job.update({
    status: 'pending',
    run_at: new Date(),
    attempts: 0,
    payload: {
      ...payload,
      recurring: { ...recurring, enabled: true },
      resumed_at: new Date(),
      resumed_by: req.user?.id || null,
    },
  });

  return res.json(serializeScheduledJob(job));
});

// --- Delete scheduled message ---
controller.deleteSchedule = asyncHandler(async (req, res) => {
  const device = await getOwnedDevice(req.params.id, req.organizationId);
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }

  const job = await db.Job.findByPk(req.params.jobId);
  if (!job || job.type !== 'single_send') {
    return res.status(404).json({ message: 'Scheduled message not found' });
  }

  if (!isScheduleOwnedByContext(job, req.organizationId, req.params.id)) {
    return res.status(403).json({ message: 'You do not have access to this schedule' });
  }

  if (job.status === 'processing') {
    return res.status(409).json({ message: 'Schedule is currently processing and cannot be deleted' });
  }

  await job.destroy();
  return res.json({ success: true, message: 'Scheduled message deleted' });
});

// --- Send bulk messages ---
controller.sendBulk = asyncHandler(async (req, res) => {
  const { contacts, message, delay, batchSize, batchPause } = req.body;

  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ message: 'contacts array is required' });
  }

  if (!message) {
    return res.status(400).json({ message: 'message template is required' });
  }

  const device = await getOwnedDevice(req.params.id, req.organizationId);
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }

  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin) {
    const quota = await quotaService.checkQuota(req.organizationId);
    if (!quota.hasActiveSubscription || !quota.allowed) {
      return res.status(403).json({
        message: !quota.hasActiveSubscription
          ? 'Subscription is required before sending messages'
          : 'Quota exhausted. Please upgrade your plan.',
        quota,
      });
    }
  }

  const job = await db.Job.create({
    type: 'bulk_send',
    payload: {
      organizationId: req.organizationId,
      deviceId: Number(req.params.id),
      contacts,
      message,
      options: {
        delay,
        batchSize,
        batchPause,
        bypassQuota: isAdmin,
      },
      source: 'api:sendBulk',
      created_by: req.user.id,
    },
    status: 'pending',
    attempts: 0,
    run_at: new Date(),
  });

  res.json({
    success: true,
    message: `Bulk send queued for ${contacts.length} contacts`,
    job_id: job.id,
    job_status: job.status,
    totalContacts: contacts.length,
  });
});

// --- Upload Excel & send bulk ---
controller.sendBulkExcel = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Excel file is required' });
  }

  const { message } = req.body;
  if (!message) {
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'message template is required' });
  }

  try {
    // Dynamic import for xlsx parsing
    let XLSX;
    try {
      XLSX = require('xlsx');
    } catch (e) {
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ message: 'xlsx module not installed. Run: npm install xlsx' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Clean up file
    fs.unlinkSync(req.file.path);

    if (!data || data.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty' });
    }

    // Strict parsing: canonical columns are `phone` and optional `name`.
    // Additional columns are kept as-is and matched exactly with template variables.
    const contacts = data.map((row) => {
      const phone = String(row?.phone || '').trim();
      const name = String(row?.name || '').trim();

      const extraVariables = {};
      Object.entries(row || {}).forEach(([key, value]) => {
        if (!key) return;
        if (key === 'phone' || key === 'name') return;
        if (value === undefined || value === null || value === '') return;
        extraVariables[key] = String(value).trim();
      });

      return {
        phone,
        name,
        ...extraVariables,
      };
    }).filter(c => c.phone);

    if (contacts.length === 0) {
      return res.status(400).json({
        message: 'No valid contacts found. Make sure Excel has columns: phone/nomor/no_hp and name/nama',
      });
    }

    const device = await getOwnedDevice(req.params.id, req.organizationId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin) {
      const quota = await quotaService.checkQuota(req.organizationId);
      if (!quota.hasActiveSubscription || !quota.allowed) {
        return res.status(403).json({
          message: !quota.hasActiveSubscription
            ? 'Subscription is required before sending messages'
            : 'Quota exhausted. Please upgrade your plan.',
          quota,
        });
      }
    }

    const job = await db.Job.create({
      type: 'bulk_send',
      payload: {
        organizationId: req.organizationId,
        deviceId: Number(req.params.id),
        contacts,
        message,
        options: {
          bypassQuota: isAdmin,
        },
        source: 'api:sendBulkExcel',
        created_by: req.user.id,
      },
      status: 'pending',
      attempts: 0,
      run_at: new Date(),
    });

    res.json({
      success: true,
      message: `Bulk send queued for ${contacts.length} contacts from Excel`,
      job_id: job.id,
      job_status: job.status,
      totalContacts: contacts.length,
      preview: contacts.slice(0, 5),
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Failed to parse Excel file', error: err.message });
  }
});

module.exports = controller;
