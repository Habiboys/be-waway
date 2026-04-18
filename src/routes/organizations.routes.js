const router = require('express').Router();
const c = require('../controllers/organization.controller');

router.post('/', c.create);
router.get('/', c.list);
router.get('/invitations', c.myInvitations);
router.post('/invitations/:invitationId/accept', c.acceptInvitation);
router.post('/invitations/:invitationId/reject', c.rejectInvitation);
router.get('/:id', c.detail);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

router.post('/:id/invite', c.invite);
router.get('/:id/members', c.members);
router.delete('/:id/members/:userId', c.removeMember);

module.exports = router;
