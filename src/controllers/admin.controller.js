const asyncHandler = require('../utils/asyncHandler');
const bcrypt = require('bcryptjs');
const { Payment, PaymentLog, Plan, Subscription, User, Organization, UsageLog } = require('../models');

function getOrderPlanFromLogs(logs = []) {
  const orderLog = logs.find((log) => log.event_type === 'order_created');
  const payload = orderLog?.payload || {};
  return {
    plan_id: payload.plan_id || null,
    plan_name: payload.plan_name || null,
    plan_price: payload.plan_price || null,
    plan_message_limit: payload.plan_message_limit || null,
    plan_duration_days: payload.plan_duration_days || null,
  };
}

function getResolvedPlanId(payment, reqBody = {}) {
  const fromLogs = getOrderPlanFromLogs(payment.logs || []).plan_id;
  const fromBody = reqBody?.plan_id || null;
  const fromSubscription = payment.subscription?.plan_id || null;

  return Number(fromLogs || fromBody || fromSubscription || 0) || null;
}

function serializeOrder(payment) {
  const plan = getOrderPlanFromLogs(payment.logs || []);
  return {
    id: payment.id,
    organization_id: payment.organization_id,
    organization_name: payment.organization?.name || null,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    external_id: payment.external_id,
    paid_at: payment.paid_at,
    created_at: payment.created_at,
    plan,
    subscription: payment.subscription ? {
      id: payment.subscription.id,
      plan_id: payment.subscription.plan_id,
      start_date: payment.subscription.start_date,
      end_date: payment.subscription.end_date,
      status: payment.subscription.status,
    } : null,
  };
}

exports.listOrders = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) {
    where.status = req.query.status;
  }

  const rows = await Payment.findAll({
    where,
    include: [
      { model: PaymentLog, as: 'logs' },
      { model: Organization, as: 'organization', attributes: ['id', 'name'] },
      { model: Subscription, as: 'subscription' },
    ],
    order: [['id', 'DESC']],
  });

  res.json(rows.map(serializeOrder));
});

exports.approveOrder = asyncHandler(async (req, res) => {
  const payment = await Payment.findByPk(req.params.id, {
    include: [
      { model: PaymentLog, as: 'logs' },
      { model: Subscription, as: 'subscription' },
    ],
  });

  if (!payment) return res.status(404).json({ message: 'Order not found' });
  if (payment.status !== 'pending') {
    return res.status(400).json({ message: 'Only pending order can be approved' });
  }

  const planId = getResolvedPlanId(payment, req.body || {});
  if (!planId) {
    return res.status(400).json({
      message: 'Order is missing plan information. Please provide plan_id when approving this order.',
    });
  }

  const plan = await Plan.findByPk(planId);
  if (!plan) return res.status(404).json({ message: 'Plan not found' });

  const now = new Date();
  const activeSub = await Subscription.findOne({
    where: { organization_id: payment.organization_id, status: 'active' },
    order: [['end_date', 'DESC']],
  });

  let subscription;
  if (activeSub && new Date(activeSub.end_date) > now) {
    const startPoint = new Date(activeSub.end_date);
    const endDate = new Date(startPoint.getTime() + (Number(plan.duration_days || 30) * 24 * 60 * 60 * 1000));
    await activeSub.update({
      plan_id: plan.id,
      end_date: endDate,
    });
    subscription = activeSub;
  } else {
    const endDate = new Date(now.getTime() + (Number(plan.duration_days || 30) * 24 * 60 * 60 * 1000));
    subscription = await Subscription.create({
      organization_id: payment.organization_id,
      plan_id: plan.id,
      start_date: now,
      end_date: endDate,
      status: 'active',
    });
  }

  await payment.update({
    status: 'paid',
    subscription_id: subscription.id,
    paid_at: now,
    payment_gateway: 'manual_approval',
  });

  await PaymentLog.create({
    payment_id: payment.id,
    event_type: 'order_approved',
    event_id: `approve-${payment.id}-${Date.now()}`,
    payload: {
      approved_by: req.user.id,
      plan_id: plan.id,
      subscription_id: subscription.id,
    },
    status: 'processed',
    created_at: new Date(),
  });

  const refreshed = await Payment.findByPk(payment.id, {
    include: [
      { model: PaymentLog, as: 'logs' },
      { model: Subscription, as: 'subscription' },
      { model: Organization, as: 'organization', attributes: ['id', 'name'] },
    ],
  });

  res.json(serializeOrder(refreshed));
});

exports.rejectOrder = asyncHandler(async (req, res) => {
  const payment = await Payment.findByPk(req.params.id, {
    include: [{ model: PaymentLog, as: 'logs' }],
  });

  if (!payment) return res.status(404).json({ message: 'Order not found' });
  if (payment.status !== 'pending') {
    return res.status(400).json({ message: 'Only pending order can be rejected' });
  }

  await payment.update({ status: 'rejected', payment_gateway: 'manual_approval' });

  await PaymentLog.create({
    payment_id: payment.id,
    event_type: 'order_rejected',
    event_id: `reject-${payment.id}-${Date.now()}`,
    payload: {
      rejected_by: req.user.id,
      reason: req.body?.reason || null,
    },
    status: 'processed',
    created_at: new Date(),
  });

  const refreshed = await Payment.findByPk(payment.id, {
    include: [
      { model: PaymentLog, as: 'logs' },
      { model: Organization, as: 'organization', attributes: ['id', 'name'] },
      { model: Subscription, as: 'subscription' },
    ],
  });

  res.json(serializeOrder(refreshed));
});

exports.listUsers = asyncHandler(async (req, res) => {
  const rows = await User.findAll({
    attributes: { exclude: ['password'] },
    order: [['id', 'DESC']],
  });

  res.json(rows);
});

exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const payload = {};
  if (typeof req.body?.name === 'string') {
    const nextName = req.body.name.trim();
    if (!nextName) {
      return res.status(400).json({ message: 'Name cannot be empty' });
    }
    payload.name = nextName;
  }
  if (typeof req.body?.role === 'string') {
    const allowedRoles = ['admin', 'member'];
    if (!allowedRoles.includes(req.body.role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    payload.role = req.body.role;
  }

  if (typeof req.body?.email === 'string') {
    const nextEmail = req.body.email.trim().toLowerCase();
    if (!nextEmail) {
      return res.status(400).json({ message: 'Email cannot be empty' });
    }

    const duplicate = await User.findOne({ where: { email: nextEmail } });
    if (duplicate && Number(duplicate.id) !== Number(user.id)) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    payload.email = nextEmail;
  }

  if (typeof req.body?.password === 'string') {
    const nextPassword = req.body.password.trim();
    if (nextPassword) {
      if (nextPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      payload.password = await bcrypt.hash(nextPassword, 10);
    }
  }

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ message: 'No valid fields to update' });
  }

  await user.update(payload);

  const refreshed = await User.findByPk(user.id, {
    attributes: { exclude: ['password'] },
  });

  return res.json(refreshed);
});

exports.softDeleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (Number(user.id) === Number(req.user.id)) {
    return res.status(400).json({ message: 'You cannot soft-delete your own account' });
  }

  if (user.deleted_at) {
    return res.status(400).json({ message: 'User is already soft-deleted' });
  }

  await user.update({ deleted_at: new Date() });

  const refreshed = await User.findByPk(user.id, {
    attributes: { exclude: ['password'] },
  });

  return res.json({
    message: 'User soft-deleted',
    user: refreshed,
  });
});

exports.listOrganizations = asyncHandler(async (req, res) => {
  const rows = await Organization.findAll({
    include: [{
      model: Subscription,
      as: 'subscriptions',
      include: [{ model: Plan, as: 'plan' }],
    }],
    order: [['id', 'DESC']],
  });

  res.json(rows);
});

exports.dashboard = asyncHandler(async (req, res) => {
  const [totalUsers, totalOrganizations, totalMessages, revenue, pendingOrders] = await Promise.all([
    User.count(),
    Organization.count(),
    UsageLog.sum('messages_sent'),
    Payment.sum('amount', { where: { status: 'paid' } }),
    Payment.count({ where: { status: 'pending' } }),
  ]);

  res.json({
    total_users: Number(totalUsers || 0),
    total_organizations: Number(totalOrganizations || 0),
    total_messages: Number(totalMessages || 0),
    revenue: Number(revenue || 0),
    pending_orders: Number(pendingOrders || 0),
  });
});
