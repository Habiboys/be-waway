const router = require('express').Router();
const c = require('../controllers/contact.controller');

router.post('/', c.create);
router.get('/', c.list);
router.get('/:id', c.detail);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

router.post('/import', c.import);

module.exports = router;
