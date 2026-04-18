const router = require('express').Router();
const c = require('../controllers/admin.controller');
const adminMiddleware = require('../middlewares/adminMiddleware');

router.use(adminMiddleware);

router.get('/orders', c.listOrders);
router.post('/orders/:id/approve', c.approveOrder);
router.post('/orders/:id/reject', c.rejectOrder);
router.get('/users', c.listUsers);
router.put('/users/:id', c.updateUser);
router.delete('/users/:id', c.softDeleteUser);
router.get('/organizations', c.listOrganizations);
router.get('/dashboard', c.dashboard);

module.exports = router;
