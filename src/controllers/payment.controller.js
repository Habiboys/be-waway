const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const { Payment, Plan, Subscription, PaymentLog } = require('../models');

function pickPlanFromLogs(logs = []) {
  const orderLog = logs.find((log) => log.event_type === 'order_created');
  const payload = orderLog?.payload || {};

  return {
    id: payload.plan_id || null,
    name: payload.plan_name || null,
    price: payload.plan_price || null,
    message_limit: payload.plan_message_limit || null,
    device_limit: payload.plan_device_limit || null,
    duration_days: payload.plan_duration_days || null,
  };
}

function serializeOrder(payment) {
  const relationPlan = payment.plan
    ? {
        id: payment.plan.id,
        name: payment.plan.name,
        price: Number(payment.plan.price || 0),
        message_limit: payment.plan.message_limit,
        device_limit: payment.plan.device_limit,
        duration_days: payment.plan.duration_days,
      }
    : null;

  const planFromLogs = pickPlanFromLogs(payment.logs || []);

  return {
    id: payment.id,
    organization_id: payment.organization_id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    payment_gateway: payment.payment_gateway,
    external_id: payment.external_id,
    transaction_id: payment.transaction_id,
    paid_at: payment.paid_at,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
    plan: relationPlan || planFromLogs,
    subscription: payment.subscription ? {
      id: payment.subscription.id,
      plan_id: payment.subscription.plan_id,
      start_date: payment.subscription.start_date,
      end_date: payment.subscription.end_date,
      status: payment.subscription.status,
      plan: payment.subscription.plan ? {
        id: payment.subscription.plan.id,
        name: payment.subscription.plan.name,
        message_limit: payment.subscription.plan.message_limit,
        device_limit: payment.subscription.plan.device_limit,
        duration_days: payment.subscription.plan.duration_days,
      } : null,
    } : null,
  };
}

exports.createInvoice = asyncHandler(async (req, res) => {
  const { plan_id } = req.body;
  const plan = await Plan.findByPk(plan_id);

  if (!plan) return res.status(404).json({ message: 'Plan not found' });

  const activeSubscription = await Subscription.findOne({
    where: { organization_id: req.organizationId, status: 'active' },
    order: [['id', 'DESC']]
  });

  const externalId = `INV-${req.organizationId}-${Date.now()}`;
  const payment = await Payment.create({
    organization_id: req.organizationId,
    plan_id: plan.id,
    subscription_id: activeSubscription?.id || null,
    amount: plan.price,
    status: 'pending',
    payment_gateway: 'manual_approval',
    external_id: externalId,
    transaction_id: crypto.randomUUID(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  await PaymentLog.create({
    payment_id: payment.id,
    event_type: 'order_created',
    event_id: `order-${payment.id}-${Date.now()}`,
    payload: {
      plan_id: plan.id,
      plan_name: plan.name,
      plan_price: Number(plan.price),
      plan_message_limit: plan.message_limit,
      plan_device_limit: plan.device_limit,
      plan_duration_days: plan.duration_days,
    },
    status: 'created',
    created_at: new Date(),
  });

  const fullOrder = await Payment.findByPk(payment.id, {
    include: [
      { model: PaymentLog, as: 'logs' },
      { model: Plan, as: 'plan' },
      {
        model: Subscription,
        as: 'subscription',
        include: [{ model: Plan, as: 'plan' }],
      },
    ],
  });

  res.status(201).json({
    ...serializeOrder(fullOrder),
    message: 'Order created and waiting for admin approval',
  });
});

exports.myOrders = asyncHandler(async (req, res) => {
  const rows = await Payment.findAll({
    where: { organization_id: req.organizationId },
    include: [
      { model: PaymentLog, as: 'logs' },
      { model: Plan, as: 'plan' },
      {
        model: Subscription,
        as: 'subscription',
        include: [{ model: Plan, as: 'plan' }],
      },
    ],
    order: [['id', 'DESC']],
  });

  return res.json(rows.map(serializeOrder));
});

exports.orderDetail = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    where: { id: req.params.id, organization_id: req.organizationId },
    include: [
      { model: PaymentLog, as: 'logs' },
      { model: Plan, as: 'plan' },
      {
        model: Subscription,
        as: 'subscription',
        include: [{ model: Plan, as: 'plan' }],
      },
    ],
  });

  if (!payment) return res.status(404).json({ message: 'Payment not found' });

  return res.json(serializeOrder(payment));
});

exports.detail = exports.orderDetail;
