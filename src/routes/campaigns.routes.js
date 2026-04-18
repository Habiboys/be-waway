const router = require('express').Router();
const c = require('../controllers/campaign.controller');

router.post('/', c.create);
router.get('/', c.list);
router.get('/:id', c.detail);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

router.post('/:id/start', c.start);
router.post('/:id/pause', c.pause);
router.post('/:id/resume', c.resume);
router.post('/:id/stop', c.stop);
router.get('/:id/messages', c.campaignMessages);

module.exports = router;
