const router = require('express').Router();
const c = require('../controllers/job.controller');

router.get('/', c.list);
router.get('/:id', c.detail);
router.post('/retry/:id', c.retry);

module.exports = router;
