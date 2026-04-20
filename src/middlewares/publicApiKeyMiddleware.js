const { Op } = require('sequelize');
const { OtpAppApiKey, OtpApp } = require('../models');
const otpService = require('../services/otpService');

module.exports = async (req, res, next) => {
  try {
    const apiKeyHeader = req.headers['x-api-key'];
    if (!apiKeyHeader) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'API_KEY_MISSING',
          message: 'x-api-key header is required',
        },
      });
    }

    const normalizedApiKey = String(apiKeyHeader).trim();
    const apiKeyHash = otpService.hashApiKey(normalizedApiKey);

    const apiKey = await OtpAppApiKey.findOne({
      where: {
        is_active: true,
        [Op.or]: [
          { api_key_hash: apiKeyHash },
          { api_key: normalizedApiKey },
        ],
      },
      include: [{ model: OtpApp, as: 'app' }],
    });

    if (!apiKey || !apiKey.app || !apiKey.app.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'API_KEY_INVALID',
          message: 'Invalid or inactive API key',
        },
      });
    }

    req.organizationId = String(apiKey.organization_id);
    req.otpAppId = String(apiKey.otp_app_id);
    req.otpApiKeyId = String(apiKey.id);
    req.otpApp = apiKey.app;

    await apiKey.update({ last_used_at: new Date() });

    return next();
  } catch (error) {
    return next(error);
  }
};
