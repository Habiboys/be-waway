const whatsappService = require('./whatsappService');
const quotaService = require('./quotaService');
const { OtpApp } = require('../models');

const DEFAULT_TEMPLATE = 'Kode OTP Anda: {{code}}. Berlaku {{ttl}} menit. Jangan bagikan kode ini ke siapapun.';

/**
 * Build the OTP message from the app template (or default).
 */
function buildMessage({ code, purpose, app, ttlSeconds }) {
  const template = app?.message_template || DEFAULT_TEMPLATE;
  const ttlMinutes = Math.ceil(Number(ttlSeconds || 300) / 60);

  return template
    .replace(/\{\{code\}\}/gi, String(code))
    .replace(/\{\{ttl\}\}/gi, String(ttlMinutes))
    .replace(/\{\{purpose\}\}/gi, String(purpose || ''))
    .replace(/\{\{app_name\}\}/gi, String(app?.name || ''));
}

/**
 * Send OTP via WhatsApp using the device assigned to the OTP app.
 * Checks OTP quota separately from message quota.
 */
exports.sendOtp = async ({ channel, destination, code, purpose, app, ttlSeconds, isAdmin }) => {
  // Always log in non-production
  if (process.env.NODE_ENV !== 'production') {
    console.log('[OTP DELIVERY]', {
      app: app?.name,
      app_id: app?.id,
      channel,
      destination,
      purpose,
      code,
    });
  }

  // Only WhatsApp channel is supported
  if (channel !== 'whatsapp') {
    console.warn(`[OTP DELIVERY] Channel "${channel}" is not supported, skipping delivery.`);
    return { accepted: false, provider: channel, message: 'Channel not supported' };
  }

  // Check OTP quota (admin bypasses quota)
  const organizationId = app?.organization_id;
  if (organizationId && !isAdmin) {
    const otpQuota = await quotaService.checkOtpQuota(organizationId);
    if (!otpQuota.hasActiveSubscription) {
      throw new Error('No active subscription. Please activate a plan first.');
    }
    if (!otpQuota.allowed) {
      throw new Error(otpQuota.message || 'OTP quota exhausted. Please upgrade your plan.');
    }
  }

  // Resolve device_id from the app
  let deviceId = app?.device_id;

  if (!deviceId) {
    if (app?.id) {
      const freshApp = await OtpApp.findByPk(app.id, { attributes: ['device_id'] });
      deviceId = freshApp?.device_id;
    }
  }

  if (!deviceId) {
    throw new Error('No WhatsApp device assigned to this OTP app. Please set a device in OTP app settings.');
  }

  // Check if device is ready
  if (!whatsappService.isReady(deviceId)) {
    throw new Error(`WhatsApp device (${deviceId}) is not connected. Please connect the device first.`);
  }

  // Build message from template
  const message = buildMessage({ code, purpose, app, ttlSeconds: ttlSeconds || 300 });

  // Send via WhatsApp service — bypass WA message quota since OTP has its own quota
  const result = await whatsappService.sendMessage(deviceId, destination, message, {
    organizationId: organizationId || null,
    bypassQuota: true,
  });

  // Consume OTP quota after successful send (always track, even admin)
  if (organizationId) {
    try {
      await quotaService.consumeOtpQuota(organizationId, 1, { skipCheck: true });
    } catch {
      // Don't fail delivery if quota tracking fails
    }
  }

  return {
    accepted: true,
    provider: 'whatsapp',
    message: 'OTP sent via WhatsApp',
    messageId: result?.id,
  };
};
