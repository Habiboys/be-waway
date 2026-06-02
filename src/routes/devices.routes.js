const router = require('express').Router();
const c = require('../controllers/device.controller');
const quotaMiddleware = require('../middlewares/quotaMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Media upload middleware (images, video, audio, documents)
const mediaUploadDir = path.join(process.cwd(), 'uploads', 'media');
if (!fs.existsSync(mediaUploadDir)) fs.mkdirSync(mediaUploadDir, { recursive: true });

const mediaUpload = multer({
  dest: mediaUploadDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    // Allow images, video, audio, documents
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mov', 'video/webm', 'video/mkv',
      'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/m4a', 'audio/aac',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|mp3|ogg|wav|pdf|doc|docx|xls|xlsx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'), false);
    }
  },
});

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
router.post('/:id/send', quotaMiddleware, c.sendTest);
router.post('/:id/send-test', quotaMiddleware, c.sendTest);
router.post('/:id/send-media', quotaMiddleware, mediaUpload.single('media'), c.sendMedia);
router.post('/:id/schedule-send', quotaMiddleware, c.scheduleSend);
router.get('/:id/schedules', c.listSchedules);
router.post('/:id/schedules/:jobId/stop', c.stopSchedule);
router.post('/:id/schedules/:jobId/resume', c.resumeSchedule);
router.delete('/:id/schedules/:jobId', c.deleteSchedule);
router.post('/:id/send-bulk', quotaMiddleware, c.sendBulk);
router.post('/:id/send-bulk-excel', quotaMiddleware, c.uploadMiddleware, c.sendBulkExcel);

module.exports = router;
