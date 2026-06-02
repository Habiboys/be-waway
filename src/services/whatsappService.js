const QRCode = require('qrcode');
const { DisconnectReason } = require('@whiskeysockets/baileys');
const db = require('../models');
const quotaService = require('./quotaService');
const BaileysTransport = require('./transports/baileysTransport');

const statuses = new Map(); // deviceId -> { status, qr, info }
const reconnectTimers = new Map(); // deviceId -> timeout
const reconnectAttempts = new Map(); // deviceId -> number
const manualDisconnects = new Set(); // deviceId set when user explicitly disconnects
const sentIdempotencyKeys = new Map(); // key -> timestamp
let _io = null;

const transport = new BaileysTransport({
  baseAuthPath: process.env.WA_AUTH_PATH || undefined,
});

const MAX_RECONNECT_ATTEMPTS = Number(process.env.WA_MAX_RECONNECT_ATTEMPTS || 10);
const BASE_RECONNECT_DELAY_MS = Number(process.env.WA_RECONNECT_BASE_DELAY_MS || 5000);
const MAX_RECONNECT_DELAY_MS = Number(process.env.WA_RECONNECT_MAX_DELAY_MS || 120000);
const IDEMPOTENCY_TTL_MS = Number(process.env.WA_IDEMPOTENCY_TTL_MS || 60 * 60 * 1000);

function setIO(io) {
  _io = io;
}

function emit(deviceId, event, data) {
  if (_io) {
    _io.emit(`device:${event}`, { deviceId, ...data });
  }
}

function toKey(deviceId) {
  return String(deviceId);
}

function cleanupIdempotencyCache() {
  const now = Date.now();
  for (const [k, ts] of sentIdempotencyKeys.entries()) {
    if ((now - ts) > IDEMPOTENCY_TTL_MS) {
      sentIdempotencyKeys.delete(k);
    }
  }
}

function markIdempotencySent(key) {
  if (!key) return;
  sentIdempotencyKeys.set(String(key), Date.now());
  if (sentIdempotencyKeys.size > 5000) {
    cleanupIdempotencyCache();
  }
}

function isIdempotencySent(key) {
  if (!key) return false;
  const ts = sentIdempotencyKeys.get(String(key));
  if (!ts) return false;
  if ((Date.now() - ts) > IDEMPOTENCY_TTL_MS) {
    sentIdempotencyKeys.delete(String(key));
    return false;
  }
  return true;
}

function updateStatus(deviceId, status, extra = {}) {
  const key = toKey(deviceId);
  const current = statuses.get(key) || {};
  statuses.set(key, { ...current, status, ...extra });
  emit(key, 'status', { status, ...extra });
}

function clearReconnect(deviceId) {
  const key = toKey(deviceId);
  const timer = reconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(key);
  }
}

function getStatus(deviceId) {
  return statuses.get(toKey(deviceId)) || { status: 'offline', qr: null, info: null };
}

function getAllStatuses() {
  const result = {};
  for (const [id, s] of statuses.entries()) {
    result[id] = s;
  }
  return result;
}

function getClient(deviceId) {
  return transport.getSession(toKey(deviceId))?.socket || null;
}

function isReady(deviceId) {
  const s = getStatus(toKey(deviceId));
  return s.status === 'ready';
}

function scheduleReconnect(deviceId, deviceRecord) {
  const key = toKey(deviceId);
  if (manualDisconnects.has(key)) return;
  if (reconnectTimers.has(key)) return;

  const attempts = Number(reconnectAttempts.get(key) || 0) + 1;
  reconnectAttempts.set(key, attempts);

  if (attempts > MAX_RECONNECT_ATTEMPTS) {
    console.warn(`[WA:${key}] Reconnect stopped. Max attempts reached (${MAX_RECONNECT_ATTEMPTS})`);
    return;
  }

  const delay = Math.min(MAX_RECONNECT_DELAY_MS, BASE_RECONNECT_DELAY_MS * (2 ** (attempts - 1)));
  console.log(`[WA:${key}] Scheduling reconnect #${attempts} in ${Math.round(delay / 1000)}s`);

  const timer = setTimeout(async () => {
    reconnectTimers.delete(key);

    try {
      const latestDevice = deviceRecord || await db.Device.findByPk(key);
      if (!latestDevice) {
        console.warn(`[WA:${key}] Device not found during reconnect`);
        return;
      }
      if (manualDisconnects.has(key)) return;

      await initClient(key, latestDevice);
    } catch (error) {
      console.error(`[WA:${key}] Reconnect attempt failed:`, error.message);
      scheduleReconnect(key, deviceRecord);
    }
  }, delay);

  if (timer.unref) timer.unref();
  reconnectTimers.set(key, timer);
}

async function mapQrToDataUrl(qr) {
  return QRCode.toDataURL(qr, {
    width: 320,
    margin: 2,
    color: { dark: '#1e293b', light: '#ffffff' },
  });
}

function parseDisconnect(update = {}) {
  const statusCode = update?.lastDisconnect?.error?.output?.statusCode;
  const reasonName = Object.keys(DisconnectReason || {}).find((k) => DisconnectReason[k] === statusCode) || 'unknown';
  return { statusCode, reasonName };
}

async function initClient(deviceId, deviceRecord) {
  const key = toKey(deviceId);
  manualDisconnects.delete(key);
  clearReconnect(key);

  const current = getStatus(key);
  if (transport.hasSession(key) && ['ready', 'qr_pending', 'authenticated', 'connecting'].includes(current.status)) {
    return current;
  }

  if (transport.hasSession(key)) {
    await transport.disconnectDevice(key);
  }

  updateStatus(key, 'connecting', { qr: null, qrRaw: null });

  await transport.connectDevice(key, {
    onQr: async (qr) => {
      try {
        const qrDataUrl = await mapQrToDataUrl(qr);
        updateStatus(key, 'qr_pending', { qr: qrDataUrl, qrRaw: qr });
        console.log(`[WA:${key}] QR code generated`);
      } catch (err) {
        console.error(`[WA:${key}] QR generation error:`, err.message);
      }
    },
    onAuthenticated: () => {
      const current = getStatus(key);
      if (current.status !== 'ready') {
        updateStatus(key, 'authenticated', { qr: null, qrRaw: null });
      }
    },
    onConnectionUpdate: async (update) => {
      const connection = update?.connection;

      if (connection === 'connecting') {
        updateStatus(key, 'connecting');
        return;
      }

      if (connection === 'open') {
        const session = transport.getSession(key);
        const userId = session?.socket?.user?.id || '';
        const phoneNumber = String(userId).split(':')[0] || (deviceRecord?.phone_number || null);
        const info = { id: userId, wid: { user: phoneNumber } };

        updateStatus(key, 'ready', { qr: null, qrRaw: null, info });
        reconnectAttempts.set(key, 0);
        clearReconnect(key);
        console.log(`[WA:${key}] Client is ready!`);

        if (deviceRecord) {
          try {
            await deviceRecord.update({
              status: 'online',
              phone_number: phoneNumber,
              last_seen: new Date(),
            });
          } catch (e) {
            console.error(`[WA:${key}] Failed to update device record:`, e.message);
          }
        }
        return;
      }

      if (connection === 'close') {
        const { statusCode, reasonName } = parseDisconnect(update);
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        updateStatus(key, loggedOut ? 'auth_failure' : 'disconnected', {
          qr: null,
          info: null,
          reason: reasonName,
        });

        if (deviceRecord) {
          try {
            await deviceRecord.update({ status: 'offline', last_seen: new Date() });
          } catch {
            // noop
          }
        }

        if (!manualDisconnects.has(key) && !loggedOut) {
          await transport.disconnectDevice(key);
          scheduleReconnect(key, deviceRecord);
        } else {
          await transport.disconnectDevice(key);
          reconnectAttempts.set(key, 0);
          clearReconnect(key);
        }
      }
    },
    onIncomingMessage: (event) => {
      const firstMessage = event?.messages?.[0];
      if (!firstMessage?.key?.fromMe) {
        const from = firstMessage?.key?.remoteJid || 'unknown';
        const body = firstMessage?.message?.conversation || '';
        console.log(`[WA:${key}] Incoming from ${from}: ${String(body).substring(0, 50)}`);
      }
    },
  });

  return getStatus(key);
}

async function disconnectClient(deviceId) {
  const key = toKey(deviceId);
  manualDisconnects.add(key);
  clearReconnect(key);
  reconnectAttempts.set(key, 0);

  await transport.disconnectDevice(key);

  statuses.set(key, { status: 'offline', qr: null, info: null });
  emit(key, 'status', { status: 'offline' });
}

async function sendMessage(deviceId, phone, message, options = {}) {
  const key = toKey(deviceId);
  const organizationId = options.organizationId || null;
  const bypassQuota = options.bypassQuota === true;

  if (organizationId && !options.skipQuotaCheck && !bypassQuota) {
    const quota = await quotaService.checkQuota(organizationId);
    if (!quota.hasActiveSubscription) {
      throw new Error('Subscription is required before sending messages');
    }
    if (!quota.allowed) {
      throw new Error('Quota exhausted. Please upgrade your plan.');
    }
  }

  if (!isReady(key)) {
    throw new Error('Device is not connected / ready');
  }

  const idempotencyKey = options.idempotencyKey || null;
  if (isIdempotencySent(idempotencyKey)) {
    return {
      id: null,
      timestamp: Math.floor(Date.now() / 1000),
      to: String(phone || ''),
      body: message,
      status: 'sent',
      skipped: true,
      reason: 'idempotent_replay',
    };
  }

  const registration = await transport.isRegisteredUser(key, phone);
  if (!registration.registered) {
    throw new Error(`Nomor ${phone} tidak terdaftar di WhatsApp`);
  }

  const result = await transport.sendMessage(key, phone, message, options);
  markIdempotencySent(idempotencyKey);

  if (organizationId && !bypassQuota) {
    await quotaService.consumeQuota(organizationId, 1, { skipCheck: true });
  }

  return result;
}

async function sendBulkMessages(deviceId, contacts, messageTemplate, options = {}) {
  const key = toKey(deviceId);
  const organizationId = options.organizationId || null;
  const bypassQuota = options.bypassQuota === true;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const randomIntInclusive = (min, max) => {
    const minInt = Math.ceil(min);
    const maxInt = Math.floor(max);
    if (!Number.isFinite(minInt) || !Number.isFinite(maxInt)) return 0;
    if (maxInt <= minInt) return minInt;
    return Math.floor(Math.random() * (maxInt - minInt + 1)) + minInt;
  };

  const normalizeMsRange = (value, defaults) => {
    if (value === null || value === undefined || value === '') return { ...defaults };
    if (value === false) return null;
    if (value === 0) return { min: 0, max: 0 };

    const toMs = (n) => {
      const num = Number(n);
      if (!Number.isFinite(num)) return Number.NaN;
      return num > 0 && num < 1000 ? Math.round(num * 1000) : Math.round(num);
    };

    if (typeof value === 'number') {
      const ms = toMs(value);
      if (!Number.isFinite(ms)) return { ...defaults };
      return { min: ms, max: ms };
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      const rangeMatch = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)$/);
      if (rangeMatch) {
        const minMs = toMs(rangeMatch[1]);
        const maxMs = toMs(rangeMatch[2]);
        if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return { ...defaults };
        return minMs <= maxMs ? { min: minMs, max: maxMs } : { min: maxMs, max: minMs };
      }

      const single = toMs(trimmed);
      if (!Number.isFinite(single)) return { ...defaults };
      return { min: single, max: single };
    }

    if (typeof value === 'object') {
      const minMs = toMs(value.min);
      const maxMs = toMs(value.max);
      if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return { ...defaults };
      return minMs <= maxMs ? { min: minMs, max: maxMs } : { min: maxMs, max: minMs };
    }

    return { ...defaults };
  };

  const applyTemplateVariables = (template = '', context = {}) => {
    return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, varKey) => {
      const value = context[varKey];
      return value === undefined || value === null || value === '' ? match : String(value);
    });
  };

  if (!isReady(key)) {
    throw new Error('Device is not connected / ready');
  }

  if (organizationId && !bypassQuota) {
    const quota = await quotaService.checkQuota(organizationId);
    if (!quota.hasActiveSubscription) {
      throw new Error('Subscription is required before sending bulk messages');
    }
    if (!quota.allowed) {
      throw new Error('Quota exhausted. Please upgrade your plan.');
    }
  }

  const results = [];
  const delayDefaults = { min: 180000, max: 600000 };
  const batchPauseDefaults = { min: 60000, max: 180000 };

  const delay = normalizeMsRange(options.delay, delayDefaults) || delayDefaults;
  const batchPause = normalizeMsRange(options.batchPause, batchPauseDefaults);
  const batchSizeRaw = options.batchSize;
  const batchSize = Math.max(1, Number.parseInt(batchSizeRaw ?? 30, 10) || 30);
  const maxRetries = Number(options.maxRetries || 3);

  for (let i = 0; i < contacts.length; i += 1) {
    const contact = contacts[i];
    const rawContext = Object.fromEntries(
      Object.entries(contact || {}).map(([ctxKey, value]) => [
        ctxKey,
        value === undefined || value === null ? '' : String(value),
      ]),
    );

    const context = {
      ...rawContext,
      name: rawContext.name || rawContext.nama || '',
      nama: rawContext.nama || rawContext.name || '',
      phone: rawContext.phone || rawContext.nomor || rawContext.no_hp || '',
      nomor: rawContext.nomor || rawContext.phone || rawContext.no_hp || '',
      no_hp: rawContext.no_hp || rawContext.phone || rawContext.nomor || '',
    };

    const phone = context.phone || '';
    const name = context.name || '';
    const message = applyTemplateVariables(messageTemplate, context);

    const idempotencyKey = options.idempotencyKey
      ? `${options.idempotencyKey}:${phone}`
      : (contact?.idempotencyKey || null);

    if (isIdempotencySent(idempotencyKey)) {
      results.push({ phone, name, status: 'sent', skipped: true, reason: 'idempotent_replay' });
      emit(key, 'bulk_progress', {
        current: i + 1,
        total: contacts.length,
        lastSent: phone,
        status: 'sent',
        skipped: true,
      });
      continue;
    }

    let sent = false;
    let lastError = null;
    let messageId = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const result = await sendMessage(key, phone, message, {
          organizationId,
          skipQuotaCheck: true,
          bypassQuota,
          mediaUrl: options.mediaUrl,
          mediaPath: options.mediaPath,
          caption: options.caption,
        });
        messageId = result.id;
        sent = true;
        markIdempotencySent(idempotencyKey);
        break;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const backoff = Math.min(30000, (2 ** (attempt - 1)) * 2000 + Math.floor(Math.random() * 1000));
          await sleep(backoff);
        }
      }
    }

    if (sent) {
      results.push({ phone, name, status: 'sent', messageId });
      emit(key, 'bulk_progress', {
        current: i + 1,
        total: contacts.length,
        lastSent: phone,
        status: 'sent',
      });
    } else {
      results.push({ phone, name, status: 'failed', error: lastError?.message || 'Failed to send message' });
      emit(key, 'bulk_progress', {
        current: i + 1,
        total: contacts.length,
        lastSent: phone,
        status: 'failed',
        error: lastError?.message || 'Failed to send message',
      });
    }

    if (i < contacts.length - 1) {
      const messageDelayMs = randomIntInclusive(delay.min, delay.max);
      if (messageDelayMs > 0) {
        await sleep(messageDelayMs);
      }

      if (batchPause && (i + 1) % batchSize === 0) {
        const pauseTimeMs = randomIntInclusive(batchPause.min, batchPause.max);
        if (pauseTimeMs > 0) {
          console.log(`[WA:${key}] Batch pause ${Math.round(pauseTimeMs / 1000)}s after ${i + 1} messages`);
          emit(key, 'bulk_progress', { pausing: true, resumeIn: pauseTimeMs });
          await sleep(pauseTimeMs);
        }
      }
    }
  }

  emit(key, 'bulk_complete', {
    total: contacts.length,
    sent: results.filter((r) => r.status === 'sent').length,
    failed: results.filter((r) => r.status === 'failed').length,
  });

  return results;
}

module.exports = {
  setIO,
  initClient,
  disconnectClient,
  getClient,
  getStatus,
  getAllStatuses,
  isReady,
  sendMessage,
  sendBulkMessages,
};
