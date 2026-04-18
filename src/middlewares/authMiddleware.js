const jwt = require('jsonwebtoken');
const { ApiKey, Organization, User } = require('../models');

module.exports = async (req, res, next) => {
  if (req.path.startsWith('/api/webhooks/')) {
    return next();
  }

  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader) {
    const apiKey = await ApiKey.findOne({
      where: { api_key: String(apiKeyHeader), is_active: true },
      include: [{
        model: Organization,
        as: 'organization',
        include: [{ model: User, as: 'owner', attributes: ['id', 'email', 'role'] }],
      }],
    });

    if (!apiKey) {
      return res.status(401).json({ message: 'Invalid API key' });
    }

    req.organizationId = Number(apiKey.organization_id);
    req.user = {
      id: apiKey.organization?.owner?.id || 0,
      email: apiKey.organization?.owner?.email || null,
      role: apiKey.organization?.owner?.role || 'member',
      organization_id: req.organizationId,
      auth_type: 'api_key',
      api_key_id: apiKey.id,
    };

    return next();
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'change-me');
    req.user = payload;
    if (payload.organization_id && !req.organizationId) {
      req.organizationId = Number(payload.organization_id);
    }
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
