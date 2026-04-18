const router = require('express').Router();
const c = require('../controllers/subscription.controller');

router.post('/', c.create);
router.get('/', c.list);
router.get('/:id', c.detail);
router.post('/:id/upgrade', c.upgrade);
router.post('/:id/cancel', c.cancel);

module.exports = router;
