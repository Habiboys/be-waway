const { OrganizationUser } = require('../models');

module.exports = async (req, res, next) => {
  if (req.path.startsWith('/api/webhooks/')) {
    return next();
  }

  if (
    req.path.startsWith('/organizations') ||
    req.path.startsWith('/plans') ||
    req.path.startsWith('/admin')
  ) {
    return next();
  }

  const isApiKeyAuth = req.user?.auth_type === 'api_key';
  const headerOrgId = req.headers['x-organization-id'];
  const orgId = isApiKeyAuth
    ? req.organizationId
    : (headerOrgId || req.organizationId || req.user?.organization_id || req.user?.organizationId);

  if (!orgId) {
    return res.status(400).json({ message: 'Organization context is required (x-organization-id)' });
  }

  req.organizationId = Number(orgId);
  if (Number.isNaN(req.organizationId) || req.organizationId <= 0) {
    return res.status(400).json({ message: 'Invalid organization id context' });
  }

  const isAdmin = req.user?.role === 'admin';

  if (!isAdmin && !isApiKeyAuth) {
    const membership = await OrganizationUser.findOne({
      where: {
        organization_id: req.organizationId,
        user_id: req.user?.id,
        invitation_status: 'accepted',
      },
      attributes: ['id'],
    });

    if (!membership) {
      return res.status(403).json({ message: 'You do not have access to this organization' });
    }
  }

  return next();
};
