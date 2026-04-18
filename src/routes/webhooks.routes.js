const router = require('express').Router();
const c = require('../controllers/webhook.controller');

router.post('/xendit', c.xendit);

module.exports = router;
