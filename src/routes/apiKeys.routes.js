const router = require('express').Router();
const c = require('../controllers/apiKey.controller');

router.post('/', c.create);
router.get('/', c.list);
router.delete('/:id', c.remove);

module.exports = router;
