const router = require('express').Router();
const c = require('../controllers/publicOtp.controller');
const publicApiKeyMiddleware = require('../middlewares/publicApiKeyMiddleware');
const publicOtpRateLimitMiddleware = require('../middlewares/publicOtpRateLimitMiddleware');

router.use(publicApiKeyMiddleware);

router.post('/send', publicOtpRateLimitMiddleware.send, c.send);
router.post('/verify', publicOtpRateLimitMiddleware.verifyLike, c.verify);
router.post('/resend', publicOtpRateLimitMiddleware.verifyLike, c.resend);
router.post('/cancel', publicOtpRateLimitMiddleware.verifyLike, c.cancel);
router.get('/transactions/:transactionId', c.getTransaction);

module.exports = router;
