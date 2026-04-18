const asyncHandler = require('../utils/asyncHandler');
const { Payment, PaymentLog, Subscription } = require('../models');

exports.xendit = asyncHandler(async (req, res) => {
  const payload = req.body;
  const webhookToken = req.headers['x-callback-token'];
  const isVerified = webhookToken && webhookToken === process.env.XENDIT_WEBHOOK_TOKEN;

  const externalId = payload.external_id;
  const payment = await Payment.findOne({ where: { external_id: externalId } });

  if (!payment) {
    return res.status(404).json({ message: 'Payment not found' });
  }

  await PaymentLog.create({
    payment_id: payment.id,
    event_type: payload.status,
    event_id: payload.id,
    payload,
    status: isVerified ? 'verified' : 'unverified'
  });

  if (payload.status === 'PAID') {
    await payment.update({
      status: 'paid',
      xendit_invoice_id: payload.id,
      xendit_webhook_verified: !!isVerified,
      paid_at: new Date(payload.paid_at || Date.now())
    });

    if (payment.subscription_id) {
      await Subscription.update(
        { status: 'active' },
        { where: { id: payment.subscription_id } }
      );
    }
  }

  if (payload.status === 'EXPIRED') {
    await payment.update({
      status: 'expired',
      xendit_invoice_id: payload.id,
      xendit_webhook_verified: !!isVerified,
      expired_at: new Date(payload.expiry_date || Date.now())
    });
  }

  return res.json({ received: true });
});
