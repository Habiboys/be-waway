const db = require('../models');
const asyncHandler = require('../utils/asyncHandler');

// List all templates for current organization
exports.list = asyncHandler(async (req, res) => {
  const orgId = req.organizationId;
  const rows = await db.TemplateMessage.findAll({
    where: { organization_id: orgId },
    order: [['created_at', 'DESC']],
  });
  res.json(rows);
});

// Get single template (by id, must belong to org)
exports.detail = asyncHandler(async (req, res) => {
  const orgId = req.organizationId;
  const row = await db.TemplateMessage.findOne({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!row) return res.status(404).json({ message: 'Template not found' });
  res.json(row);
});

// Create template
exports.create = asyncHandler(async (req, res) => {
  const orgId = req.organizationId;
  const { name, content } = req.body;
  if (!name || !content) return res.status(400).json({ message: 'Name and content required' });
  const row = await db.TemplateMessage.create({
    organization_id: orgId,
    name,
    content,
    created_at: new Date(),
    updated_at: new Date(),
  });
  res.status(201).json(row);
});

// Update template
exports.update = asyncHandler(async (req, res) => {
  const orgId = req.organizationId;
  const { name, content } = req.body;
  const row = await db.TemplateMessage.findOne({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!row) return res.status(404).json({ message: 'Template not found' });
  row.name = name || row.name;
  row.content = content || row.content;
  row.updated_at = new Date();
  await row.save();
  res.json(row);
});

// Delete template
exports.remove = asyncHandler(async (req, res) => {
  const orgId = req.organizationId;
  const row = await db.TemplateMessage.findOne({
    where: { id: req.params.id, organization_id: orgId },
  });
  if (!row) return res.status(404).json({ message: 'Template not found' });
  await row.destroy();
  res.json({ success: true });
});
