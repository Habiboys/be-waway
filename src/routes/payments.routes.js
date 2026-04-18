const router = require('express').Router();
const c = require('../controllers/payment.controller');

router.post('/invoice', c.createInvoice);
router.get('/my-orders', c.myOrders);
router.get('/orders/:id', c.orderDetail);
router.get('/:id', c.detail);

module.exports = router;
