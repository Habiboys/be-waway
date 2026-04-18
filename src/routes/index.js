const router = require('express').Router();
const authMiddleware = require('../middlewares/authMiddleware');
const emailVerifiedMiddleware = require('../middlewares/emailVerifiedMiddleware');
const tenantMiddleware = require('../middlewares/tenantMiddleware');

router.use('/auth', require('./auth.routes'));
router.use('/webhooks', require('./webhooks.routes'));

router.use(authMiddleware);
router.use(emailVerifiedMiddleware);
router.use(tenantMiddleware);

router.use('/organizations', require('./organizations.routes'));
router.use('/devices', require('./devices.routes'));
router.use('/contacts', require('./contacts.routes'));
router.use('/contact-lists', require('./contactLists.routes'));
router.use('/campaigns', require('./campaigns.routes'));
router.use('/messages', require('./messages.routes'));
router.use('/jobs', require('./jobs.routes'));
router.use('/plans', require('./plans.routes'));
router.use('/subscriptions', require('./subscriptions.routes'));
router.use('/payments', require('./payments.routes'));
router.use('/usage', require('./usage.routes'));
router.use('/api-keys', require('./apiKeys.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/template-messages', require('./templateMessages.routes'));

module.exports = router;
