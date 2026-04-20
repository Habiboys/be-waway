const asyncHandler = require('../utils/asyncHandler');
const { UsageLog, Message } = require('../models');
const quotaService = require('../services/quotaService');

exports.usage = asyncHandler(async (req, res) => {
  const rows = await UsageLog.findAll({
    where: { organization_id: req.organizationId },
    order: [['date', 'DESC']],
    limit: 30
  });
  res.json(rows);
});

exports.daily = asyncHandler(async (req, res) => {
  const rows = await UsageLog.findAll({
    where: { organization_id: req.organizationId },
    order: [['date', 'DESC']],
    limit: 7
  });
  res.json(rows);
});

exports.dashboard = asyncHandler(async (req, res) => {
  const totalMessages = await Message.count();

  res.json({
    organization_id: req.organizationId,
    total_messages: totalMessages
  });
});

exports.quota = asyncHandler(async (req, res) => {
  const quota = await quotaService.checkQuota(req.organizationId);
  res.json(quota);
});

exports.summary = asyncHandler(async (req, res) => {
  const summary = await quotaService.getUsageSummary(req.organizationId);
  res.json(summary);
});

exports.otpQuota = asyncHandler(async (req, res) => {
  if (req.user?.role === 'admin') {
    return res.json({
      allowed: true,
      remaining: -1,
      limit: -1,
      used: 0,
      hasActiveSubscription: true,
      message: 'Admin unlimited OTP quota',
      plan: {
        id: null,
        name: 'Admin Unlimited',
      },
    });
  }

  const quota = await quotaService.checkOtpQuota(req.organizationId);
  res.json(quota);
});
