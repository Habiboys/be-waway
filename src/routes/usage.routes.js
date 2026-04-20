const router = require('express').Router();
const c = require('../controllers/usage.controller');

router.get('/quota', c.quota);
router.get('/otp-quota', c.otpQuota);
router.get('/summary', c.summary);
router.get('/', c.usage);
router.get('/daily', c.daily);
router.get('/dashboard', c.dashboard);

module.exports = router;
