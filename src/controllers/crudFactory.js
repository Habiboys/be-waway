const asyncHandler = require('../utils/asyncHandler');
const db = require('../models');

const withOrg = (req, scoped) => (scoped ? { organization_id: req.organizationId } : {});

const notFound = name => {
  const err = new Error(`${name} not found`);
  err.statusCode = 404;
  throw err;
};

const buildCrudController = ({ modelName, label, scoped = true }) => {
  const Model = db[modelName];

  return {
    list: asyncHandler(async (req, res) => {
      const rows = await Model.findAll({ where: withOrg(req, scoped), order: [['id', 'DESC']] });
      res.json(rows);
    }),

    detail: asyncHandler(async (req, res) => {
      const row = await Model.findOne({ where: { id: req.params.id, ...withOrg(req, scoped) } });
      if (!row) notFound(label);
      res.json(row);
    }),

    create: asyncHandler(async (req, res) => {
      const payload = { ...req.body, ...withOrg(req, scoped) };
      const row = await Model.create(payload);
      res.status(201).json(row);
    }),

    update: asyncHandler(async (req, res) => {
      const row = await Model.findOne({ where: { id: req.params.id, ...withOrg(req, scoped) } });
      if (!row) notFound(label);
      await row.update(req.body);
      res.json(row);
    }),

    remove: asyncHandler(async (req, res) => {
      const row = await Model.findOne({ where: { id: req.params.id, ...withOrg(req, scoped) } });
      if (!row) notFound(label);
      await row.destroy();
      res.status(204).send();
    })
  };
};

module.exports = buildCrudController;
