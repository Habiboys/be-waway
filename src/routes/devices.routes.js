const router = require('express').Router();
const c = require('../controllers/device.controller');
const quotaMiddleware = require('../middlewares/quotaMiddleware');

// CRUD
router.post('/', c.create);
router.get('/', c.list);
router.get('/all-statuses', c.allStatuses);
router.get('/:id', c.detail);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

// WhatsApp Connection
router.get('/:id/qr', c.qr);
router.post('/:id/connect', c.connect);
router.post('/:id/disconnect', c.disconnect);
router.get('/:id/status', c.status);

// Messaging
router.post('/:id/send-test', quotaMiddleware, c.sendTest);
router.post('/:id/schedule-send', quotaMiddleware, c.scheduleSend);
router.get('/:id/schedules', c.listSchedules);
router.post('/:id/schedules/:jobId/stop', c.stopSchedule);
router.post('/:id/schedules/:jobId/resume', c.resumeSchedule);
router.delete('/:id/schedules/:jobId', c.deleteSchedule);
router.post('/:id/send-bulk', quotaMiddleware, c.sendBulk);
router.post('/:id/send-bulk-excel', quotaMiddleware, c.uploadMiddleware, c.sendBulkExcel);

module.exports = router;
