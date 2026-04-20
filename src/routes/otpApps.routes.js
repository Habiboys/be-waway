const router = require('express').Router();
const c = require('../controllers/otpApp.controller');

router.post('/', c.createApp);
router.get('/', c.listApps);
router.put('/:appId', c.updateApp);
router.delete('/:appId', c.removeApp);
router.get('/:appId/keys', c.listKeys);
router.post('/:appId/keys/rotate', c.rotateKey);
router.put('/:appId/policy', c.updatePolicy);
router.get('/:appId/transactions', c.listTransactions);
router.get('/:appId/usage', c.usage);
router.post('/:appId/send', c.testSend);
router.post('/:appId/verify', c.testVerify);
router.post('/:appId/test-send', c.testSend);
router.post('/:appId/test-verify', c.testVerify);

module.exports = router;
