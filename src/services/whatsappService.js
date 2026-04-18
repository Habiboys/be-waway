const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const db = require('../models');
const quotaService = require('./quotaService');

/**
 * WhatsApp Service — manages whatsapp-web.js client instances.
 * One client per device. All state is held in-memory.
 */

const clients = new Map();   // deviceId → Client
const statuses = new Map();  // deviceId → { status, qr, info }
const reconnectTimers = new Map(); // deviceId -> timeout
const reconnectAttempts = new Map(); // deviceId -> number
const manualDisconnects = new Set(); // deviceId set when user explicitly disconnects
let _io = null;

const MAX_RECONNECT_ATTEMPTS = Number(process.env.WA_MAX_RECONNECT_ATTEMPTS || 10);
const BASE_RECONNECT_DELAY_MS = Number(process.env.WA_RECONNECT_BASE_DELAY_MS || 5000);
const MAX_RECONNECT_DELAY_MS = Number(process.env.WA_RECONNECT_MAX_DELAY_MS || 120000);

const CHROME_PATHS = {
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: '/usr/bin/google-chrome-stable',
};

function getChromePath() {
  const envPath = process.env.CHROME_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const defaultPath = CHROME_PATHS[process.platform];
  if (defaultPath && fs.existsSync(defaultPath)) return defaultPath;

  return undefined; // let puppeteer use bundled chromium
}

function setIO(io) {
  _io = io;
}

function emit(deviceId, event, data) {
  if (_io) {
    _io.emit(`device:${event}`, { deviceId, ...data });
  }
}

function clearReconnect(deviceId) {
  const key = String(deviceId);
  const timer = reconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(key);
  }
}

function scheduleReconnect(deviceId, deviceRecord) {
  const key = String(deviceId);
  if (manualDisconnects.has(key)) {
    return;
  }

  if (reconnectTimers.has(key)) {
    return;
  }

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
      const latestDevice = deviceRecord || await db.Device.findByPk(Number(key));
      if (!latestDevice) {
        console.warn(`[WA:${key}] Device not found during reconnect`);
        return;
      }

      if (manualDisconnects.has(key)) {
        return;
      }

      await initClient(key, latestDevice);
    } catch (error) {
      console.error(`[WA:${key}] Reconnect attempt failed:`, error.message);
      scheduleReconnect(key, deviceRecord);
    }
  }, delay);

  if (timer.unref) timer.unref();
  reconnectTimers.set(key, timer);
}

function getStatus(deviceId) {
  return statuses.get(String(deviceId)) || { status: 'offline', qr: null, info: null };
}

function getAllStatuses() {
  const result = {};
  for (const [id, s] of statuses.entries()) {
    result[id] = s;
  }
  return result;
}

async function initClient(deviceId, deviceRecord) {
  deviceId = String(deviceId);
  manualDisconnects.delete(deviceId);
  clearReconnect(deviceId);

  // If client already exists and is not disconnected, return current status
  if (clients.has(deviceId)) {
    const current = getStatus(deviceId);
    if (current.status === 'ready' || current.status === 'qr_pending' || current.status === 'authenticated') {
      return current;
    }
    // Cleanup stale client
    await disconnectClient(deviceId);
  }

  const authPath = path.join(process.cwd(), '.wwebjs_auth');

  const puppeteerArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--disable-gpu',
  ];

  const chromePath = getChromePath();

  const clientOptions = {
    authStrategy: new LocalAuth({
      clientId: `device-${deviceId}`,
      dataPath: authPath,
    }),
    puppeteer: {
      headless: true,
      args: puppeteerArgs,
      ...(chromePath ? { executablePath: chromePath } : {}),
    },
  };

  const client = new Client(clientOptions);

  // Update status helper
  const updateStatus = (status, extra = {}) => {
    const current = statuses.get(deviceId) || {};
    statuses.set(deviceId, { ...current, status, ...extra });
    emit(deviceId, 'status', { status, ...extra });
  };

  updateStatus('connecting');

  // --- Event Listeners ---

  client.on('qr', async (qr) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(qr, {
        width: 320,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' },
      });
      updateStatus('qr_pending', { qr: qrDataUrl, qrRaw: qr });
      console.log(`[WA:${deviceId}] QR code generated`);
    } catch (err) {
      console.error(`[WA:${deviceId}] QR generation error:`, err.message);
    }
  });

  client.on('authenticated', () => {
    updateStatus('authenticated', { qr: null, qrRaw: null });
    console.log(`[WA:${deviceId}] Authenticated`);
  });

  client.on('ready', async () => {
    let info = null;
    try {
      info = client.info;
    } catch (e) {
      // info might not be available
    }
    updateStatus('ready', { qr: null, qrRaw: null, info });
    reconnectAttempts.set(deviceId, 0);
    clearReconnect(deviceId);
    console.log(`[WA:${deviceId}] Client is ready!`);

    // Update device record in DB if provided
    if (deviceRecord) {
      try {
        await deviceRecord.update({
          status: 'online',
          phone_number: info?.wid?.user || deviceRecord.phone_number,
          last_seen: new Date(),
        });
      } catch (e) {
        console.error(`[WA:${deviceId}] Failed to update device record:`, e.message);
      }
    }
  });

  client.on('disconnected', async (reason) => {
    updateStatus('disconnected', { qr: null, info: null, reason });
    console.log(`[WA:${deviceId}] Disconnected:`, reason);
    clients.delete(deviceId);

    if (deviceRecord) {
      try {
        await deviceRecord.update({ status: 'offline', last_seen: new Date() });
      } catch (e) { /* silent */ }
    }

    const normalizedReason = String(reason || '').toUpperCase();
    const shouldReconnect =
      !manualDisconnects.has(deviceId) &&
      normalizedReason !== 'LOGOUT';

    if (shouldReconnect) {
      scheduleReconnect(deviceId, deviceRecord);
    }
  });

  client.on('auth_failure', (msg) => {
    updateStatus('auth_failure', { qr: null, error: msg });
    console.error(`[WA:${deviceId}] Auth failure:`, msg);
    clients.delete(deviceId);
    clearReconnect(deviceId);
    reconnectAttempts.set(deviceId, 0);
  });

  client.on('message', (msg) => {
    // Log incoming messages for debugging
    console.log(`[WA:${deviceId}] Incoming from ${msg.from}: ${msg.body?.substring(0, 50)}`);
  });

  clients.set(deviceId, client);

  try {
    await client.initialize();
  } catch (err) {
    updateStatus('error', { error: err.message });
    clients.delete(deviceId);
    throw err;
  }

  return getStatus(deviceId);
}

async function disconnectClient(deviceId) {
  deviceId = String(deviceId);
  manualDisconnects.add(deviceId);
  clearReconnect(deviceId);
  reconnectAttempts.set(deviceId, 0);
  const client = clients.get(deviceId);

  if (client) {
    try {
      await client.destroy();
    } catch (e) {
      console.error(`[WA:${deviceId}] Destroy error:`, e.message);
    }
    clients.delete(deviceId);
  }

  statuses.set(deviceId, { status: 'offline', qr: null, info: null });
  emit(deviceId, 'status', { status: 'offline' });
}

function getClient(deviceId) {
  return clients.get(String(deviceId));
}

function isReady(deviceId) {
  const s = getStatus(String(deviceId));
  return s.status === 'ready';
}

async function sendMessage(deviceId, phone, message, options = {}) {
  deviceId = String(deviceId);

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

  if (!isReady(deviceId)) {
    throw new Error('Device is not connected / ready');
  }

  const client = clients.get(deviceId);
  if (!client) {
    throw new Error('Client not found');
  }

  // Normalize phone number — ensure @c.us suffix
  let chatId = phone.replace(/[^0-9]/g, '');
  if (!chatId.endsWith('@c.us')) {
    chatId = `${chatId}@c.us`;
  }

  // Check if number is registered on WhatsApp
  const isRegistered = await client.isRegisteredUser(chatId);
  if (!isRegistered) {
    throw new Error(`Nomor ${phone} tidak terdaftar di WhatsApp`);
  }

  const sendOptions = {};

  // Handle media attachment
  if (options.mediaUrl) {
    try {
      const media = await MessageMedia.fromUrl(options.mediaUrl);
      sendOptions.media = media;
      if (options.caption) sendOptions.caption = options.caption;
    } catch (e) {
      console.error(`[WA:${deviceId}] Media download error:`, e.message);
    }
  }

  if (options.mediaPath) {
    try {
      const media = MessageMedia.fromFilePath(options.mediaPath);
      return await client.sendMessage(chatId, media, { caption: message });
    } catch (e) {
      console.error(`[WA:${deviceId}] Media file error:`, e.message);
    }
  }

  const result = await client.sendMessage(chatId, message, sendOptions);

  if (organizationId && !bypassQuota) {
    await quotaService.consumeQuota(organizationId, 1, { skipCheck: true });
  }

  return {
    id: result.id?._serialized,
    timestamp: result.timestamp,
    to: chatId,
    body: message,
    status: 'sent',
  };
}

async function sendBulkMessages(deviceId, contacts, messageTemplate, options = {}) {
  deviceId = String(deviceId);
  const organizationId = options.organizationId || null;
  const bypassQuota = options.bypassQuota === true;

  if (!isReady(deviceId)) {
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
  const delay = options.delay || { min: 5000, max: 15000 }; // 5-15 seconds
  const batchSize = options.batchSize || 30;
  const batchPause = options.batchPause || { min: 60000, max: 180000 }; // 1-3 minutes
  const maxRetries = Number(options.maxRetries || 3);

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const phone = contact.phone || contact.phone_number || contact.nomor;
    const name = contact.name || contact.nama || '';

    // Replace template variables
    let message = messageTemplate
      .replace(/\{\{name\}\}/gi, name)
      .replace(/\{\{nama\}\}/gi, name)
      .replace(/\{\{phone\}\}/gi, phone);

    let sent = false;
    let lastError = null;
    let messageId = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await sendMessage(deviceId, phone, message, {
          organizationId,
          skipQuotaCheck: true,
          bypassQuota,
        });
        messageId = result.id;
        sent = true;
        break;
      } catch (err) {
        lastError = err;

        if (attempt < maxRetries) {
          const backoff = Math.min(30000, (2 ** (attempt - 1)) * 2000 + Math.floor(Math.random() * 1000));
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }

    if (sent) {
      results.push({ phone, name, status: 'sent', messageId });

      emit(deviceId, 'bulk_progress', {
        current: i + 1,
        total: contacts.length,
        lastSent: phone,
        status: 'sent',
      });
    } else {
      results.push({ phone, name, status: 'failed', error: lastError?.message || 'Failed to send message' });

      emit(deviceId, 'bulk_progress', {
        current: i + 1,
        total: contacts.length,
        lastSent: phone,
        status: 'failed',
        error: lastError?.message || 'Failed to send message',
      });
    }

    // Delay between messages
    if (i < contacts.length - 1) {
      const randomDelay = Math.floor(Math.random() * (delay.max - delay.min + 1)) + delay.min;

      // Batch pause — after every batchSize messages, take a longer break
      if ((i + 1) % batchSize === 0) {
        const pauseTime = Math.floor(Math.random() * (batchPause.max - batchPause.min + 1)) + batchPause.min;
        console.log(`[WA:${deviceId}] Batch pause ${Math.round(pauseTime / 1000)}s after ${i + 1} messages`);
        emit(deviceId, 'bulk_progress', { pausing: true, resumeIn: pauseTime });
        await new Promise(r => setTimeout(r, pauseTime));
      } else {
        await new Promise(r => setTimeout(r, randomDelay));
      }
    }
  }

  emit(deviceId, 'bulk_complete', {
    total: contacts.length,
    sent: results.filter(r => r.status === 'sent').length,
    failed: results.filter(r => r.status === 'failed').length,
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
