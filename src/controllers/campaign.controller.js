const buildCrudController = require('./crudFactory');
const asyncHandler = require('../utils/asyncHandler');
const { Campaign, Message, Job } = require('../models');

const controller = buildCrudController({ modelName: 'Campaign', label: 'Campaign' });

controller.start = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ where: { id: req.params.id, organization_id: req.organizationId } });
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

  await campaign.update({ status: 'running' });

  // TODO: generate messages from list and push into queue worker
  await Job.create({
    type: 'campaign_start',
    payload: { campaign_id: campaign.id, organization_id: req.organizationId },
    status: 'pending'
  });

  res.json({ message: 'Campaign started', campaign_id: campaign.id });
});

controller.pause = asyncHandler(async (req, res) => {
  await Campaign.update({ status: 'paused' }, { where: { id: req.params.id, organization_id: req.organizationId } });
  res.json({ message: 'Campaign paused' });
});

controller.resume = asyncHandler(async (req, res) => {
  await Campaign.update({ status: 'running' }, { where: { id: req.params.id, organization_id: req.organizationId } });
  res.json({ message: 'Campaign resumed' });
});

controller.stop = asyncHandler(async (req, res) => {
  await Campaign.update({ status: 'stopped' }, { where: { id: req.params.id, organization_id: req.organizationId } });
  res.json({ message: 'Campaign stopped' });
});

controller.campaignMessages = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({
    where: { id: req.params.id, organization_id: req.organizationId },
    attributes: ['id'],
  });

  if (!campaign) {
    return res.status(404).json({ message: 'Campaign not found' });
  }

  const rows = await Message.findAll({ where: { campaign_id: req.params.id }, order: [['id', 'DESC']] });
  res.json(rows);
});

module.exports = controller;
