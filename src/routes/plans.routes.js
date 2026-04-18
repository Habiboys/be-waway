const router = require('express').Router();
const c = require('../controllers/plan.controller');

router.get('/', c.list);
router.get('/:id', c.detail);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
