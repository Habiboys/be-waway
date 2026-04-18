const buildCrudController = require('./crudFactory');
const asyncHandler = require('../utils/asyncHandler');
const { Job } = require('../models');

const controller = buildCrudController({ modelName: 'Job', label: 'Job', scoped: false });

controller.retry = asyncHandler(async (req, res) => {
  const row = await Job.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: 'Job not found' });

  await row.update({ status: 'pending' });
  return res.json(row);
});

module.exports = controller;
