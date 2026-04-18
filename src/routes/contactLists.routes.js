const router = require('express').Router();
const c = require('../controllers/contactList.controller');

router.post('/', c.create);
router.get('/', c.list);
router.get('/:id', c.detail);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

router.post('/:id/contacts', c.assignContacts);
router.delete('/:id/contacts/:contactId', c.removeContact);
router.get('/:id/contacts', c.contacts);

module.exports = router;
