const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { OtpApp, OtpAppApiKey, OtpAppPolicy, OtpTransaction, Device, sequelize } = require('../models');
const otpService = require('../services/otpService');
const otpDeliveryService = require('../services/otpDeliveryService');

const ENVIRONMENTS = new Set(['sandbox', 'production']);

const DEFAULT_OTP_TEMPLATE = OtpApp.DEFAULT_OTP_TEMPLATE || 'Kode OTP Anda: {{code}}. Berlaku {{ttl}} menit. Jangan bagikan kode ini ke siapapun.';

const getApiKeyPreview = (row) => otpService.maskApiKey(row.api_key, row.key_prefix);

const createDefaultPolicy = (payload = {}) => ({
  ttl_seconds: Math.min(900, Math.max(60, Number(payload.ttl_seconds || 300))),
  code_length: Math.min(8, Math.max(4, Number(payload.code_length || 6))),
  max_attempts: Math.min(15, Math.max(1, Number(payload.max_attempts || 5))),
  resend_cooldown_seconds: Math.min(600, Math.max(10, Number(payload.resend_cooldown_seconds || 60))),
  max_resend: Math.min(20, Math.max(0, Number(payload.max_resend || 3))),
  rate_limit_per_minute: Math.min(300, Math.max(1, Number(payload.rate_limit_per_minute || 30))),
});

const ensureApp = async (organizationId, appId) => {
  return OtpApp.findOne({
    where: {
      id: appId,
      organization_id: organizationId,
    },
  });
};

exports.createApp = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const environment = String(req.body?.environment || 'sandbox').toLowerCase();
  const deviceId = String(req.body?.device_id || '').trim() || null;
  const messageTemplate = String(req.body?.message_template || '').trim() || DEFAULT_OTP_TEMPLATE;

  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  if (!ENVIRONMENTS.has(environment)) {
    return res.status(400).json({ message: 'Invalid environment' });
  }

  // Validate device belongs to same org
  if (deviceId) {
    const device = await Device.findOne({
      where: { id: deviceId, organization_id: req.organizationId },
    });
    if (!device) {
      return res.status(400).json({ message: 'Device not found or does not belong to this organization' });
    }
  }

  const exists = await OtpApp.findOne({
    where: {
      organization_id: req.organizationId,
      name,
      environment,
    },
  });

  if (exists) {
    return res.status(409).json({ message: 'OTP app with same name and environment already exists' });
  }

  const result = await sequelize.transaction(async (transaction) => {
    const app = await OtpApp.create({
      organization_id: req.organizationId,
      name,
      environment,
      default_channel: 'whatsapp',
      device_id: deviceId,
      message_template: messageTemplate,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    }, { transaction });

    const policyPayload = createDefaultPolicy(req.body?.policy);
    const policy = await OtpAppPolicy.create({
      otp_app_id: app.id,
      organization_id: req.organizationId,
      ...policyPayload,
      updated_at: new Date(),
    }, { transaction });

    const apiKeyValue = otpService.generateApiKey(environment);
    const key = await OtpAppApiKey.create({
      otp_app_id: app.id,
      organization_id: req.organizationId,
      api_key: null,
      api_key_hash: otpService.hashApiKey(apiKeyValue),
      key_prefix: otpService.getApiKeyPrefix(apiKeyValue),
      is_active: true,
      created_at: new Date(),
    }, { transaction });

    return { app, policy, key, apiKeyValue };
  });

  return res.status(201).json({
    success: true,
    data: {
      app: result.app,
      policy: result.policy,
      api_key: result.apiKeyValue,
      key_id: result.key.id,
      note: 'Simpan API key ini sekarang. Setelah halaman ditutup key tidak ditampilkan lagi.',
    },
  });
});

exports.listApps = asyncHandler(async (req, res) => {
  const apps = await OtpApp.findAll({
    where: { organization_id: req.organizationId },
    include: [
      { model: OtpAppPolicy, as: 'policy' },
      { model: OtpAppApiKey, as: 'apiKeys', where: { is_active: true }, required: false },
      { model: Device, as: 'device', attributes: ['id', 'device_name', 'phone_number', 'status'] },
    ],
    order: [['created_at', 'DESC']],
  });

  return res.json({
    success: true,
    data: apps.map((app) => ({
      id: app.id,
      organization_id: app.organization_id,
      name: app.name,
      environment: app.environment,
      default_channel: app.default_channel,
      device_id: app.device_id,
      message_template: app.message_template,
      device: app.device || null,
      is_active: app.is_active,
      created_at: app.created_at,
      policy: app.policy,
      active_keys: (app.apiKeys || []).map((key) => ({
        id: key.id,
        key_preview: getApiKeyPreview(key),
        is_active: key.is_active,
        created_at: key.created_at,
        last_used_at: key.last_used_at,
      })),
    })),
  });
});

exports.updateApp = asyncHandler(async (req, res) => {
  const app = await ensureApp(req.organizationId, req.params.appId);
  if (!app) {
    return res.status(404).json({ message: 'OTP app not found' });
  }

  const updates = {};

  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ message: 'name cannot be empty' });
    updates.name = name;
  }

  if (req.body?.device_id !== undefined) {
    const deviceId = String(req.body.device_id || '').trim() || null;
    if (deviceId) {
      const device = await Device.findOne({
        where: { id: deviceId, organization_id: req.organizationId },
      });
      if (!device) {
        return res.status(400).json({ message: 'Device not found or does not belong to this organization' });
      }
    }
    updates.device_id = deviceId;
  }

  if (req.body?.message_template !== undefined) {
    updates.message_template = String(req.body.message_template || '').trim() || DEFAULT_OTP_TEMPLATE;
  }

  if (req.body?.is_active !== undefined) {
    updates.is_active = !!req.body.is_active;
  }

  updates.updated_at = new Date();
  await app.update(updates);

  return res.json({
    success: true,
    data: app,
  });
});

exports.removeApp = asyncHandler(async (req, res) => {
  const app = await ensureApp(req.organizationId, req.params.appId);
  if (!app) {
    return res.status(404).json({ message: 'OTP app not found' });
  }

  await app.destroy();
  return res.status(204).send();
});

exports.listKeys = asyncHandler(async (req, res) => {
  const app = await ensureApp(req.organizationId, req.params.appId);
  if (!app) {
    return res.status(404).json({ message: 'OTP app not found' });
  }

  const keys = await OtpAppApiKey.findAll({
    where: {
      otp_app_id: app.id,
      organization_id: req.organizationId,
    },
    order: [['created_at', 'DESC']],
  });

  return res.json({
    success: true,
    data: keys.map((key) => ({
      id: key.id,
      is_active: key.is_active,
      key_preview: getApiKeyPreview(key),
      created_at: key.created_at,
      revoked_at: key.revoked_at,
      last_used_at: key.last_used_at,
    })),
  });
});

exports.rotateKey = asyncHandler(async (req, res) => {
  const app = await ensureApp(req.organizationId, req.params.appId);
  if (!app) {
    return res.status(404).json({ message: 'OTP app not found' });
  }

  const apiKeyValue = otpService.generateApiKey(app.environment);

  const newKey = await sequelize.transaction(async (transaction) => {
    await OtpAppApiKey.update(
      {
        is_active: false,
        revoked_at: new Date(),
      },
      {
        where: {
          otp_app_id: app.id,
          organization_id: req.organizationId,
          is_active: true,
        },
        transaction,
      }
    );

    return OtpAppApiKey.create({
      otp_app_id: app.id,
      organization_id: req.organizationId,
      api_key: null,
      api_key_hash: otpService.hashApiKey(apiKeyValue),
      key_prefix: otpService.getApiKeyPrefix(apiKeyValue),
      is_active: true,
      created_at: new Date(),
      revoked_at: null,
    }, { transaction });
  });

  return res.status(201).json({
    success: true,
    data: {
      key_id: newKey.id,
      api_key: apiKeyValue,
      created_at: newKey.created_at,
      note: 'API key lama sudah otomatis nonaktif.',
    },
  });
});

exports.updatePolicy = asyncHandler(async (req, res) => {
  const app = await ensureApp(req.organizationId, req.params.appId);
  if (!app) {
    return res.status(404).json({ message: 'OTP app not found' });
  }

  const policy = await OtpAppPolicy.findOne({
    where: {
      otp_app_id: app.id,
      organization_id: req.organizationId,
    },
  });

  if (!policy) {
    return res.status(404).json({ message: 'OTP policy not found' });
  }

  const payload = createDefaultPolicy({
    ttl_seconds: req.body?.ttl_seconds ?? policy.ttl_seconds,
    code_length: req.body?.code_length ?? policy.code_length,
    max_attempts: req.body?.max_attempts ?? policy.max_attempts,
    resend_cooldown_seconds: req.body?.resend_cooldown_seconds ?? policy.resend_cooldown_seconds,
    max_resend: req.body?.max_resend ?? policy.max_resend,
    rate_limit_per_minute: req.body?.rate_limit_per_minute ?? policy.rate_limit_per_minute,
  });

  await policy.update({
    ...payload,
    updated_at: new Date(),
  });

  return res.json({
    success: true,
    data: policy,
  });
});

exports.listTransactions = asyncHandler(async (req, res) => {
  const app = await ensureApp(req.organizationId, req.params.appId);
  if (!app) {
    return res.status(404).json({ message: 'OTP app not found' });
  }

  const page = Math.max(1, Number(req.query?.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 15)));
  const offset = (page - 1) * limit;
  const status = String(req.query?.status || '').trim().toLowerCase();

  const where = {
    organization_id: req.organizationId,
    otp_app_id: app.id,
  };

  if (status) {
    where.status = status;
  }

  const { count, rows } = await OtpTransaction.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  const totalPages = Math.ceil(count / limit);

  return res.json({
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      purpose: row.purpose,
      status: row.status,
      destination_masked: row.destination_masked,
      reference_id: row.reference_id,
      attempt_count: row.attempt_count,
      max_attempts: row.max_attempts,
      resend_count: row.resend_count,
      expires_at: row.expires_at,
      created_at: row.created_at,
      verified_at: row.verified_at,
    })),
    pagination: {
      page,
      limit,
      total: count,
      totalPages,
    },
  });
});

exports.usage = asyncHandler(async (req, res) => {
  const app = await ensureApp(req.organizationId, req.params.appId);
  if (!app) {
    return res.status(404).json({ message: 'OTP app not found' });
  }

  const days = Math.min(90, Math.max(1, Number(req.query?.days || 30)));
  const from = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

  const rows = await OtpTransaction.findAll({
    where: {
      organization_id: req.organizationId,
      otp_app_id: app.id,
      created_at: { [Op.gte]: from },
    },
    attributes: ['status', 'channel', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['status', 'channel'],
    raw: true,
  });

  return res.json({
    success: true,
    data: {
      app_id: app.id,
      range_days: days,
      items: rows.map((row) => ({
        status: row.status,
        channel: row.channel,
        count: Number(row.count || 0),
      })),
    },
  });
});

// ─── Dashboard Test: Send OTP ───────────────────────────────────────
exports.testSend = asyncHandler(async (req, res) => {
  const app = await ensureApp(req.organizationId, req.params.appId);
  if (!app) {
    return res.status(404).json({ message: 'OTP app not found' });
  }

  if (!app.is_active) {
    return res.status(403).json({ message: 'OTP app is inactive' });
  }

  const destination = otpService.normalizeDestination(req.body?.destination, 'whatsapp');
  const purpose = String(req.body?.purpose || 'login').toLowerCase();

  if (!destination) {
    return res.status(400).json({ message: 'destination is required' });
  }

  // Get policy
  const policy = await OtpAppPolicy.findOne({
    where: { otp_app_id: app.id, organization_id: req.organizationId },
  });
  const normalizedPolicy = otpService.normalizePolicy(policy || {});
  const code = otpService.generateOtpCode(normalizedPolicy.code_length);
  const now = new Date();
  const idempotencyKey = `dashboard-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const row = await OtpTransaction.create({
    organization_id: req.organizationId,
    otp_app_id: app.id,
    api_key_id: null,
    channel: 'whatsapp',
    purpose,
    destination,
    destination_hash: otpService.hashDestination(destination),
    destination_masked: otpService.maskDestination(destination, 'whatsapp'),
    reference_id: 'dashboard-test',
    code_hash: otpService.hashOtpCode(code),
    status: 'sent',
    attempt_count: 0,
    resend_count: 0,
    max_attempts: normalizedPolicy.max_attempts,
    max_resend: normalizedPolicy.max_resend,
    expires_at: new Date(now.getTime() + (normalizedPolicy.ttl_seconds * 1000)),
    next_resend_at: new Date(now.getTime() + (normalizedPolicy.resend_cooldown_seconds * 1000)),
    idempotency_key: idempotencyKey,
    metadata: { source: 'dashboard-test' },
    created_at: now,
    updated_at: now,
  });

  // Send via WhatsApp
  try {
    await otpDeliveryService.sendOtp({
      channel: 'whatsapp',
      destination,
      code,
      purpose,
      app,
      ttlSeconds: normalizedPolicy.ttl_seconds,
      isAdmin: req.user?.role === 'admin',
    });
  } catch (deliveryError) {
    // Update transaction status to failed
    await row.update({ status: 'failed', updated_at: new Date() });
    return res.status(500).json({
      success: false,
      message: deliveryError.message || 'Failed to send OTP via WhatsApp',
    });
  }

  return res.status(201).json({
    success: true,
    data: {
      transaction_id: row.id,
      status: row.status,
      channel: 'whatsapp',
      purpose,
      destination_masked: row.destination_masked,
      expires_at: row.expires_at,
      otp_code: app.environment === 'sandbox' ? code : undefined,
    },
  });
});

// ─── Dashboard Test: Verify OTP ─────────────────────────────────────
exports.testVerify = asyncHandler(async (req, res) => {
  const app = await ensureApp(req.organizationId, req.params.appId);
  if (!app) {
    return res.status(404).json({ message: 'OTP app not found' });
  }

  const transactionId = String(req.body?.transaction_id || '').trim();
  const code = String(req.body?.code || '').trim();

  if (!transactionId || !code) {
    return res.status(400).json({ message: 'transaction_id and code are required' });
  }

  const row = await OtpTransaction.findOne({
    where: {
      id: transactionId,
      organization_id: req.organizationId,
      otp_app_id: app.id,
    },
  });

  if (!row) {
    return res.status(404).json({ message: 'OTP transaction not found' });
  }

  if (row.status === 'verified') {
    return res.status(409).json({ message: 'OTP already verified' });
  }

  if (['cancelled', 'blocked'].includes(row.status)) {
    return res.status(409).json({ message: `OTP transaction is ${row.status}` });
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await row.update({ status: 'expired', updated_at: new Date() });
    return res.status(409).json({ message: 'OTP has expired' });
  }

  const submittedHash = otpService.hashOtpCode(code);
  if (submittedHash !== row.code_hash) {
    const nextAttempt = Number(row.attempt_count || 0) + 1;
    const shouldBlock = nextAttempt >= Number(row.max_attempts || 0);

    await row.update({
      attempt_count: nextAttempt,
      status: shouldBlock ? 'blocked' : row.status,
      updated_at: new Date(),
    });

    return res.status(400).json({
      message: 'Invalid OTP code',
      attempts_left: Math.max(0, Number(row.max_attempts || 0) - nextAttempt),
    });
  }

  await row.update({
    status: 'verified',
    verified_at: new Date(),
    used_at: new Date(),
    updated_at: new Date(),
  });

  return res.json({
    success: true,
    data: {
      transaction_id: row.id,
      verified: true,
      status: 'verified',
      verified_at: row.verified_at,
    },
  });
});
