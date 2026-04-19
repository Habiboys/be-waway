const asyncHandler = require('../utils/asyncHandler');
const { Organization, OrganizationUser, User } = require('../models');

const isAdmin = (req) => req.user?.role === 'admin';

const getOrganizationForUser = async (req, organizationId, { requireOwner = false } = {}) => {
  const orgId = String(organizationId || '').trim();
  if (!orgId) return null;

  if (isAdmin(req)) {
    return Organization.findByPk(orgId);
  }

  const membership = await OrganizationUser.findOne({
    where: {
      organization_id: orgId,
      user_id: req.user.id,
      invitation_status: 'accepted',
    },
  });

  if (!membership) return null;

  if (requireOwner && membership.role !== 'owner') {
    return null;
  }

  return Organization.findByPk(orgId);
};

exports.list = asyncHandler(async (req, res) => {
  if (isAdmin(req)) {
    const rows = await Organization.findAll({
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email'],
          required: false,
        },
        {
          model: OrganizationUser,
          as: 'memberships',
          attributes: ['id', 'organization_id', 'user_id', 'role'],
          required: false,
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'email', 'role'],
              required: false,
            },
          ],
        },
      ],
      order: [['id', 'DESC']],
    });
    return res.json(rows);
  }

  const rows = await Organization.findAll({
    include: [{
      model: OrganizationUser,
      as: 'memberships',
      where: { user_id: req.user.id, invitation_status: 'accepted' },
      required: true,
      attributes: [],
    }],
    order: [['id', 'DESC']],
  });

  return res.json(rows);
});

exports.detail = asyncHandler(async (req, res) => {
  const org = await getOrganizationForUser(req, req.params.id);
  if (!org) return res.status(404).json({ message: 'Organization not found' });
  return res.json(org);
});

exports.create = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ message: 'name is required' });

  const ownerId = isAdmin(req) && req.body?.owner_id
    ? String(req.body.owner_id).trim()
    : String(req.user.id);

  const org = await Organization.create({
    name,
    owner_id: ownerId,
  });

  await OrganizationUser.findOrCreate({
    where: {
      organization_id: org.id,
      user_id: ownerId,
    },
    defaults: {
      organization_id: org.id,
      user_id: ownerId,
      role: 'owner',
      invitation_status: 'accepted',
      invited_by: req.user?.id || null,
      invited_at: new Date(),
      responded_at: new Date(),
    },
  });

  return res.status(201).json(org);
});

exports.update = asyncHandler(async (req, res) => {
  const org = await getOrganizationForUser(req, req.params.id, { requireOwner: true });
  if (!org) return res.status(404).json({ message: 'Organization not found' });

  const payload = {};
  if (typeof req.body?.name === 'string' && req.body.name.trim()) {
    payload.name = req.body.name.trim();
  }

  if (!Object.keys(payload).length) {
    return res.status(400).json({ message: 'No valid fields to update' });
  }

  await org.update(payload);
  return res.json(org);
});

exports.remove = asyncHandler(async (req, res) => {
  const org = await getOrganizationForUser(req, req.params.id, { requireOwner: true });
  if (!org) return res.status(404).json({ message: 'Organization not found' });

  await org.destroy();
  return res.status(204).send();
});

exports.invite = asyncHandler(async (req, res) => {
  const org = await getOrganizationForUser(req, req.params.id, { requireOwner: true });
  if (!org) return res.status(404).json({ message: 'Organization not found' });

  const role = req.body?.role === 'owner' ? 'owner' : 'member';

  let targetUser = null;
  const userId = req.body?.user_id ? String(req.body.user_id).trim() : '';
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (userId) {
    targetUser = await User.findByPk(userId, { attributes: ['id', 'name', 'email', 'role'] });
  } else if (email) {
    targetUser = await User.findOne({
      where: { email },
      attributes: ['id', 'name', 'email', 'role'],
    });
  } else {
    return res.status(400).json({ message: 'user_id or email is required' });
  }

  if (!targetUser) {
    return res.status(404).json({ message: 'User not found for invite target' });
  }

  const [row] = await OrganizationUser.findOrCreate({
    where: {
      organization_id: String(req.params.id),
      user_id: targetUser.id,
    },
    defaults: {
      organization_id: String(req.params.id),
      user_id: targetUser.id,
      role,
      invitation_status: 'pending',
      invited_by: req.user.id,
      invited_at: new Date(),
      responded_at: null,
    },
  });

  if (row.invitation_status === 'accepted') {
    return res.status(409).json({ message: 'User is already an accepted member' });
  }

  await row.update({
    role,
    invitation_status: 'pending',
    invited_by: req.user.id,
    invited_at: new Date(),
    responded_at: null,
  });

  return res.status(201).json({
    ...row.toJSON(),
    invited_user: targetUser,
    message: 'Invitation sent',
  });
});

exports.members = asyncHandler(async (req, res) => {
  const org = await getOrganizationForUser(req, req.params.id);
  if (!org) return res.status(404).json({ message: 'Organization not found' });

  const rows = await OrganizationUser.findAll({
    where: { organization_id: req.params.id },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'role'],
        required: false,
      },
      {
        model: User,
        as: 'inviter',
        attributes: ['id', 'name', 'email'],
        required: false,
      },
    ],
  });
  return res.json(rows);
});

exports.myInvitations = asyncHandler(async (req, res) => {
  const rows = await OrganizationUser.findAll({
    where: {
      user_id: req.user.id,
      invitation_status: 'pending',
    },
    include: [
      {
        model: Organization,
        as: 'organization',
        attributes: ['id', 'name', 'owner_id'],
      },
      {
        model: User,
        as: 'inviter',
        attributes: ['id', 'name', 'email'],
        required: false,
      },
    ],
    order: [['id', 'DESC']],
  });

  return res.json(rows);
});

exports.acceptInvitation = asyncHandler(async (req, res) => {
  const row = await OrganizationUser.findOne({
    where: {
      id: req.params.invitationId,
      user_id: req.user.id,
      invitation_status: 'pending',
    },
  });

  if (!row) {
    return res.status(404).json({ message: 'Pending invitation not found' });
  }

  await row.update({ invitation_status: 'accepted', responded_at: new Date() });
  return res.json({ message: 'Invitation accepted', invitation_id: row.id });
});

exports.rejectInvitation = asyncHandler(async (req, res) => {
  const row = await OrganizationUser.findOne({
    where: {
      id: req.params.invitationId,
      user_id: req.user.id,
      invitation_status: 'pending',
    },
  });

  if (!row) {
    return res.status(404).json({ message: 'Pending invitation not found' });
  }

  await row.update({ invitation_status: 'rejected', responded_at: new Date() });
  return res.json({ message: 'Invitation rejected', invitation_id: row.id });
});

exports.removeMember = asyncHandler(async (req, res) => {
  const org = await getOrganizationForUser(req, req.params.id, { requireOwner: true });
  if (!org) return res.status(404).json({ message: 'Organization not found' });

  await OrganizationUser.destroy({
    where: { organization_id: req.params.id, user_id: req.params.userId },
  });

  return res.status(204).send();
});
