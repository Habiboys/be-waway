const router = require('express').Router();
const c = require('../controllers/message.controller');

router.get('/', c.list);
router.get('/:id', c.detail);

module.exports = router;
