const buildCrudController = require('./crudFactory');
const asyncHandler = require('../utils/asyncHandler');
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

    // Normalize contacts — support various column names
    const contacts = data.map(row => {
      const phone = row.phone || row.phone_number || row.nomor || row.no_hp || row.hp ||
                    row.Phone || row['Phone Number'] || row.Nomor || row['No HP'] || '';
      const name = row.name || row.nama || row.Name || row.Nama || '';
      return { phone: String(phone).trim(), name: String(name).trim() };
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
