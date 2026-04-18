const quotaService = require('../services/quotaService');

module.exports = async (req, res, next) => {
  try {
    if (req.user?.role === 'admin') {
      return next();
    }

    const quota = await quotaService.checkQuota(req.organizationId);

    if (!quota.hasActiveSubscription) {
      return res.status(403).json({
        message: 'Subscription is required before sending messages',
        quota,
      });
    }

    if (!quota.allowed) {
      return res.status(403).json({
        message: 'Quota exhausted. Please upgrade your plan.',
        quota,
      });
    }

    req.quota = quota;
    return next();
  } catch (error) {
    return next(error);
  }
};
