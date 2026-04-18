const { User } = require('../models');

module.exports = async (req, res, next) => {
  const isApiKeyAuth = req.user?.auth_type === 'api_key';
  if (isApiKeyAuth) {
    return next();
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = await User.findByPk(userId, {
    attributes: ['id', 'deleted_at', 'email_verified_at'],
  });

  if (!user || user.deleted_at) {
    return res.status(403).json({ message: 'Account has been deactivated' });
  }

  if (!user.email_verified_at) {
    return res.status(403).json({
      message: 'Email belum diverifikasi. Silakan verifikasi email terlebih dahulu.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  return next();
};
