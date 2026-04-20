const asyncHandler = require('../utils/asyncHandler');
const { OtpTransaction, OtpAppPolicy } = require('../models');
const otpService = require('../services/otpService');
const otpDeliveryService = require('../services/otpDeliveryService');

const CHANNELS = new Set(['whatsapp']);
const PURPOSES = new Set(['login', 'register', 'payment', 'custom']);

const respondError = (res, status, code, message, details) => {
  const error = {
    code,
    message,
  };

  if (details) {
    error.details = details;
  }

  return res.status(status).json({
    success: false,
    error,
  });
};

const toTransactionResponse = (row) => {
  return {
    transaction_id: row.id,
    status: row.status,
    channel: row.channel,
    purpose: row.purpose,
    destination_masked: row.destination_masked,
    reference_id: row.reference_id,
    expires_at: row.expires_at,
    next_resend_at: row.next_resend_at,
    attempt_count: row.attempt_count,
    max_attempts: row.max_attempts,
    resend_count: row.resend_count,
    max_resend: row.max_resend,
    verified_at: row.verified_at,
    created_at: row.created_at,
  };
};

const getPolicy = async (organizationId, otpAppId) => {
  const policy = await OtpAppPolicy.findOne({
    where: {
      organization_id: organizationId,
      otp_app_id: otpAppId,
    },
  });

  if (!policy) {
    return {
      ttl_seconds: 300,
      code_length: 6,
      max_attempts: 5,
      resend_cooldown_seconds: 60,
      max_resend: 3,
    };
  }

  return otpService.normalizePolicy(policy);
};

exports.send = asyncHandler(async (req, res) => {
  if (!req.otpApp?.is_active) {
    return respondError(res, 403, 'APP_INACTIVE', 'OTP app is inactive');
  }

  const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
  if (!idempotencyKey) {
    return respondError(res, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required');
  }

  const channel = String(req.body?.channel || req.otpApp.default_channel || '').toLowerCase();
  const purpose = String(req.body?.purpose || '').toLowerCase();
  const destination = otpService.normalizeDestination(req.body?.destination, channel);
  const referenceId = String(req.body?.reference_id || '').trim() || null;

  if (!CHANNELS.has(channel)) {
    return respondError(res, 400, 'INVALID_CHANNEL', 'Only whatsapp channel is supported');
  }

  if (!PURPOSES.has(purpose)) {
    return respondError(res, 400, 'INVALID_PURPOSE', 'purpose must be login, register, payment, or custom');
  }

  if (!destination) {
    return respondError(res, 400, 'INVALID_DESTINATION', 'destination is required');
  }

  const existing = await OtpTransaction.findOne({
    where: {
      otp_app_id: req.otpAppId,
      idempotency_key: idempotencyKey,
    },
  });

  if (existing) {
    return res.json({
      success: true,
      data: toTransactionResponse(existing),
      meta: { idempotent: true },
    });
  }

  const policy = await getPolicy(req.organizationId, req.otpAppId);
  const normalizedPolicy = otpService.normalizePolicy(policy, req.body || {});
  const code = otpService.generateOtpCode(normalizedPolicy.code_length);
  const now = new Date();

  const row = await OtpTransaction.create({
    organization_id: req.organizationId,
    otp_app_id: req.otpAppId,
    api_key_id: req.otpApiKeyId,
    channel,
    purpose,
    destination,
    destination_hash: otpService.hashDestination(destination),
    destination_masked: otpService.maskDestination(destination, channel),
    reference_id: referenceId,
    code_hash: otpService.hashOtpCode(code),
    status: 'sent',
    attempt_count: 0,
    resend_count: 0,
    max_attempts: normalizedPolicy.max_attempts,
    max_resend: normalizedPolicy.max_resend,
    expires_at: new Date(now.getTime() + (normalizedPolicy.ttl_seconds * 1000)),
    next_resend_at: new Date(now.getTime() + (normalizedPolicy.resend_cooldown_seconds * 1000)),
    idempotency_key: idempotencyKey,
    metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : null,
    created_at: now,
    updated_at: now,
  });

  await otpDeliveryService.sendOtp({
    channel,
    destination,
    code,
    purpose,
    app: req.otpApp,
    ttlSeconds: normalizedPolicy.ttl_seconds,
  });

  return res.status(201).json({
    success: true,
    data: {
      ...toTransactionResponse(row),
      ...(process.env.NODE_ENV === 'production' ? {} : { otp_code: code }),
    },
  });
});

exports.verify = asyncHandler(async (req, res) => {
  const transactionId = String(req.body?.transaction_id || '').trim();
  const code = String(req.body?.code || '').trim();

  if (!transactionId || !code) {
    return respondError(res, 400, 'INVALID_PAYLOAD', 'transaction_id and code are required');
  }

  const row = await OtpTransaction.findOne({
    where: {
      id: transactionId,
      organization_id: req.organizationId,
      otp_app_id: req.otpAppId,
    },
  });

  if (!row) {
    return respondError(res, 404, 'OTP_TRANSACTION_NOT_FOUND', 'OTP transaction not found');
  }

  if (row.status === 'verified') {
    return respondError(res, 409, 'OTP_ALREADY_VERIFIED', 'OTP already verified');
  }

  if (row.status === 'cancelled') {
    return respondError(res, 409, 'OTP_CANCELLED', 'OTP transaction has been cancelled');
  }

  if (row.status === 'blocked') {
    return respondError(res, 409, 'OTP_MAX_ATTEMPTS_REACHED', 'OTP transaction has been blocked');
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await row.update({ status: 'expired', updated_at: new Date() });
    return respondError(res, 409, 'OTP_EXPIRED', 'OTP has expired');
  }

  const submittedHash = otpService.hashOtpCode(code);
  if (submittedHash !== row.code_hash) {
    const nextAttempt = Number(row.attempt_count || 0) + 1;
    const shouldBlock = nextAttempt >= Number(row.max_attempts || 0);

    await row.update({
      attempt_count: nextAttempt,
      status: shouldBlock ? 'blocked' : row.status,
      blocked_until: shouldBlock ? new Date(Date.now() + 15 * 60 * 1000) : row.blocked_until,
      updated_at: new Date(),
    });

    return respondError(res, 400, 'OTP_INVALID_CODE', 'Invalid OTP code', {
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

exports.resend = asyncHandler(async (req, res) => {
  const transactionId = String(req.body?.transaction_id || '').trim();
  if (!transactionId) {
    return respondError(res, 400, 'INVALID_PAYLOAD', 'transaction_id is required');
  }

  const row = await OtpTransaction.findOne({
    where: {
      id: transactionId,
      organization_id: req.organizationId,
      otp_app_id: req.otpAppId,
    },
  });

  if (!row) {
    return respondError(res, 404, 'OTP_TRANSACTION_NOT_FOUND', 'OTP transaction not found');
  }

  if (otpService.statusIsFinal(row.status)) {
    return respondError(res, 409, 'OTP_STATE_NOT_ALLOWED', `Cannot resend OTP in status ${row.status}`);
  }

  const now = Date.now();
  if (new Date(row.expires_at).getTime() <= now) {
    await row.update({ status: 'expired', updated_at: new Date() });
    return respondError(res, 409, 'OTP_EXPIRED', 'OTP has expired');
  }

  if (Number(row.resend_count || 0) >= Number(row.max_resend || 0)) {
    return respondError(res, 409, 'OTP_MAX_RESEND_REACHED', 'Maximum resend reached');
  }

  if (new Date(row.next_resend_at).getTime() > now) {
    return respondError(res, 409, 'OTP_RESEND_COOLDOWN', 'Resend cooldown is still active', {
      next_resend_at: row.next_resend_at,
    });
  }

  const policy = await getPolicy(req.organizationId, req.otpAppId);
  const code = otpService.generateOtpCode(policy.code_length);
  const resendCount = Number(row.resend_count || 0) + 1;
  const nowDate = new Date();

  await row.update({
    code_hash: otpService.hashOtpCode(code),
    resend_count: resendCount,
    status: 'sent',
    expires_at: new Date(nowDate.getTime() + (policy.ttl_seconds * 1000)),
    next_resend_at: new Date(nowDate.getTime() + (policy.resend_cooldown_seconds * 1000)),
    updated_at: nowDate,
  });

  await otpDeliveryService.sendOtp({
    channel: row.channel,
    destination: row.destination,
    code,
    purpose: row.purpose,
    app: req.otpApp,
    ttlSeconds: policy.ttl_seconds,
  });

  return res.json({
    success: true,
    data: {
      ...toTransactionResponse(row),
      ...(process.env.NODE_ENV === 'production' ? {} : { otp_code: code }),
    },
  });
});

exports.cancel = asyncHandler(async (req, res) => {
  const transactionId = String(req.body?.transaction_id || '').trim();
  if (!transactionId) {
    return respondError(res, 400, 'INVALID_PAYLOAD', 'transaction_id is required');
  }

  const row = await OtpTransaction.findOne({
    where: {
      id: transactionId,
      organization_id: req.organizationId,
      otp_app_id: req.otpAppId,
    },
  });

  if (!row) {
    return respondError(res, 404, 'OTP_TRANSACTION_NOT_FOUND', 'OTP transaction not found');
  }

  if (otpService.statusIsFinal(row.status)) {
    return res.json({
      success: true,
      data: toTransactionResponse(row),
    });
  }

  await row.update({
    status: 'cancelled',
    cancelled_at: new Date(),
    updated_at: new Date(),
  });

  return res.json({
    success: true,
    data: toTransactionResponse(row),
  });
});

exports.getTransaction = asyncHandler(async (req, res) => {
  const row = await OtpTransaction.findOne({
    where: {
      id: req.params.transactionId,
      organization_id: req.organizationId,
      otp_app_id: req.otpAppId,
    },
  });

  if (!row) {
    return respondError(res, 404, 'OTP_TRANSACTION_NOT_FOUND', 'OTP transaction not found');
  }

  if (row.status === 'sent' && new Date(row.expires_at).getTime() <= Date.now()) {
    await row.update({ status: 'expired', updated_at: new Date() });
  }

  return res.json({
    success: true,
    data: toTransactionResponse(row),
  });
});
