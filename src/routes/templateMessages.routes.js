const router = require('express').Router();
const c = require('../controllers/templateMessage.controller');
const auth = require('../middlewares/authMiddleware');
const tenant = require('../middlewares/tenantMiddleware');

router.use(auth, tenant);

router.get('/', c.list);
router.get('/:id', c.detail);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
