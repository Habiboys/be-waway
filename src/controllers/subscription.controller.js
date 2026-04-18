const buildCrudController = require('./crudFactory');
const asyncHandler = require('../utils/asyncHandler');
const { Subscription } = require('../models');

const controller = buildCrudController({ modelName: 'Subscription', label: 'Subscription' });

controller.upgrade = asyncHandler(async (req, res) => {
  const row = await Subscription.findOne({ where: { id: req.params.id, organization_id: req.organizationId } });
  if (!row) return res.status(404).json({ message: 'Subscription not found' });

  const { plan_id } = req.body;
  await row.update({ plan_id });
  res.json(row);
});

controller.cancel = asyncHandler(async (req, res) => {
  const row = await Subscription.findOne({ where: { id: req.params.id, organization_id: req.organizationId } });
  if (!row) return res.status(404).json({ message: 'Subscription not found' });

  await row.update({ status: 'cancelled' });
  res.json(row);
});

module.exports = controller;
