const buildCrudController = require('./crudFactory');
const asyncHandler = require('../utils/asyncHandler');
const { ContactList, ContactListItem, Contact } = require('../models');

const controller = buildCrudController({ modelName: 'ContactList', label: 'Contact list' });

const getOwnedList = async (listId, organizationId) => {
  return ContactList.findOne({
    where: {
      id: listId,
      organization_id: organizationId,
    },
  });
};

controller.assignContacts = asyncHandler(async (req, res) => {
  const { contact_ids = [] } = req.body;

  const list = await getOwnedList(req.params.id, req.organizationId);
  if (!list) {
    return res.status(404).json({ message: 'Contact list not found' });
  }

  const validContacts = await Contact.findAll({
    where: {
      id: contact_ids,
      organization_id: req.organizationId,
    },
    attributes: ['id'],
  });

  const validContactIds = validContacts.map((c) => c.id);

  const rows = await ContactListItem.bulkCreate(
    validContactIds.map(contactId => ({ list_id: req.params.id, contact_id: contactId })),
    { ignoreDuplicates: true }
  );

  res.status(201).json({
    inserted: rows.length,
    requested: contact_ids.length,
    accepted: validContactIds.length,
    skipped: Math.max(0, contact_ids.length - validContactIds.length),
    items: rows,
  });
});

controller.removeContact = asyncHandler(async (req, res) => {
  const list = await getOwnedList(req.params.id, req.organizationId);
  if (!list) {
    return res.status(404).json({ message: 'Contact list not found' });
  }

  const contact = await Contact.findOne({
    where: { id: req.params.contactId, organization_id: req.organizationId },
    attributes: ['id'],
  });

  if (!contact) {
    return res.status(404).json({ message: 'Contact not found' });
  }

  await ContactListItem.destroy({ where: { list_id: req.params.id, contact_id: req.params.contactId } });
  res.status(204).send();
});

controller.contacts = asyncHandler(async (req, res) => {
  const list = await getOwnedList(req.params.id, req.organizationId);
  if (!list) {
    return res.status(404).json({ message: 'Contact list not found' });
  }

  const rows = await ContactListItem.findAll({
    where: { list_id: req.params.id },
    include: [{
      model: Contact,
      as: 'contact',
      where: { organization_id: req.organizationId },
      required: true,
    }],
  });

  res.json(rows);
});

module.exports = controller;
