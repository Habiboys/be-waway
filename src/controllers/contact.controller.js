const buildCrudController = require('./crudFactory');
const asyncHandler = require('../utils/asyncHandler');
const { Contact, ContactList, ContactListItem, sequelize } = require('../models');

const controller = buildCrudController({ modelName: 'Contact', label: 'Contact' });

controller.list = asyncHandler(async (req, res) => {
  const rows = await Contact.findAll({
    where: { organization_id: req.organizationId },
    order: [['id', 'DESC']],
    include: [
      {
        model: ContactListItem,
        as: 'listItems',
        required: false,
        include: [
          {
            model: ContactList,
            as: 'list',
            attributes: ['id', 'name'],
            required: false,
          },
        ],
      },
    ],
  });

  res.json(rows);
});

controller.create = asyncHandler(async (req, res) => {
  const { contact_list_ids, ...payload } = req.body || {};

  if (!Array.isArray(contact_list_ids) || contact_list_ids.length === 0) {
    return res.status(400).json({
      message: 'contact_list_ids is required and must contain at least 1 list id',
    });
  }

  const listIds = [...new Set(
    contact_list_ids
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  )];

  if (listIds.length === 0) {
    return res.status(400).json({
      message: 'contact_list_ids contains invalid ids',
    });
  }

  const ownedLists = await ContactList.findAll({
    where: {
      id: listIds,
      organization_id: req.organizationId,
    },
    attributes: ['id'],
  });

  if (ownedLists.length !== listIds.length) {
    return res.status(400).json({
      message: 'One or more contact lists are invalid or not owned by this organization',
    });
  }

  const row = await sequelize.transaction(async (transaction) => {
    const created = await Contact.create(
      {
        ...payload,
        organization_id: req.organizationId,
      },
      { transaction }
    );

    await ContactListItem.bulkCreate(
      listIds.map((listId) => ({
        list_id: listId,
        contact_id: created.id,
      })),
      {
        ignoreDuplicates: true,
        transaction,
      }
    );

    return created;
  });

  res.status(201).json(row);
});

controller.update = asyncHandler(async (req, res) => {
  const { contact_list_ids, ...payload } = req.body || {};

  const contact = await Contact.findOne({
    where: {
      id: req.params.id,
      organization_id: req.organizationId,
    },
  });

  if (!contact) {
    return res.status(404).json({ message: 'Contact not found' });
  }

  let listIds = null;
  if (contact_list_ids !== undefined) {
    if (!Array.isArray(contact_list_ids) || contact_list_ids.length === 0) {
      return res.status(400).json({
        message: 'contact_list_ids must contain at least 1 list id when provided',
      });
    }

    listIds = [...new Set(
      contact_list_ids
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )];

    if (listIds.length === 0) {
      return res.status(400).json({
        message: 'contact_list_ids contains invalid ids',
      });
    }

    const ownedLists = await ContactList.findAll({
      where: {
        id: listIds,
        organization_id: req.organizationId,
      },
      attributes: ['id'],
    });

    if (ownedLists.length !== listIds.length) {
      return res.status(400).json({
        message: 'One or more contact lists are invalid or not owned by this organization',
      });
    }
  }

  const row = await sequelize.transaction(async (transaction) => {
    await contact.update(payload, { transaction });

    if (Array.isArray(listIds)) {
      await ContactListItem.destroy({
        where: { contact_id: contact.id },
        transaction,
      });

      await ContactListItem.bulkCreate(
        listIds.map((listId) => ({
          list_id: listId,
          contact_id: contact.id,
        })),
        {
          ignoreDuplicates: true,
          transaction,
        }
      );
    }

    return contact;
  });

  res.json(row);
});

controller.import = asyncHandler(async (req, res) => {
  res.json({ message: 'Import kontak akan diproses', payload: req.body });
});

module.exports = controller;
