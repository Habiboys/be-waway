const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
} = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

function toKey(deviceId) {
  return String(deviceId);
}

function normalizePhoneToJid(phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) throw new Error('Nomor tujuan tidak valid');
  return jidNormalizedUser(`${digits}@s.whatsapp.net`);
}

function inferMediaTypeFromPath(filePath) {
  const ext = String(path.extname(filePath) || '').toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'image';
  if (['.mp4', '.mov', '.mkv', '.webm'].includes(ext)) return 'video';
  if (['.mp3', '.ogg', '.wav', '.m4a', '.aac'].includes(ext)) return 'audio';
  return 'document';
}

function inferMediaTypeFromContentType(contentType = '') {
  const ct = String(contentType).toLowerCase();
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('video/')) return 'video';
  if (ct.startsWith('audio/')) return 'audio';
  return 'document';
}

class BaileysTransport {
  constructor(options = {}) {
    this.baseAuthPath = options.baseAuthPath || path.join(process.cwd(), '.baileys_auth');
    this.sessions = new Map(); // deviceId -> { socket, saveCreds, authPath }

    if (!fs.existsSync(this.baseAuthPath)) {
      fs.mkdirSync(this.baseAuthPath, { recursive: true });
    }
  }

  async connectDevice(deviceId, lifecycle = {}) {
    const key = toKey(deviceId);
    const existing = this.sessions.get(key);
    if (existing?.socket) {
      return existing.socket;
    }

    const authPath = path.join(this.baseAuthPath, `device-${key}`);
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      browser: ['WABlast', 'Chrome', '1.0.0'],
    });

    socket.ev.on('creds.update', async (...args) => {
      await saveCreds(...args);
      if (lifecycle.onAuthenticated) {
        lifecycle.onAuthenticated();
      }
    });

    if (lifecycle.onQr || lifecycle.onConnectionUpdate) {
      socket.ev.on('connection.update', (update) => {
        if (update.qr && lifecycle.onQr) lifecycle.onQr(update.qr);
        if (lifecycle.onConnectionUpdate) lifecycle.onConnectionUpdate(update);
      });
    }

    if (lifecycle.onIncomingMessage) {
      socket.ev.on('messages.upsert', (event) => {
        lifecycle.onIncomingMessage(event);
      });
    }

    this.sessions.set(key, { socket, saveCreds, authPath });
    return socket;
  }

  async disconnectDevice(deviceId, options = {}) {
    const key = toKey(deviceId);
    const entry = this.sessions.get(key);
    if (!entry) return;

    const socket = entry.socket;
    this.sessions.delete(key);

    try {
      if (options.logout) {
        await socket.logout();
      } else {
        socket.ws?.close();
      }
    } catch {
      // noop
    }
  }

  getSession(deviceId) {
    return this.sessions.get(toKey(deviceId)) || null;
  }

  hasSession(deviceId) {
    return this.sessions.has(toKey(deviceId));
  }

  async isRegisteredUser(deviceId, phone) {
    const key = toKey(deviceId);
    const socket = this.sessions.get(key)?.socket;
    if (!socket) throw new Error('Client not found');

    const chatId = normalizePhoneToJid(phone);
    const result = await socket.onWhatsApp(chatId);
    const registered = Array.isArray(result) && result[0]?.exists === true;
    return { registered, chatId };
  }

  async sendMessage(deviceId, phone, message, options = {}) {
    const key = toKey(deviceId);
    const socket = this.sessions.get(key)?.socket;
    if (!socket) throw new Error('Client not found');

    const chatId = normalizePhoneToJid(phone);

    if (options.mediaPath) {
      const mediaType = options.mediaMimeType
        ? inferMediaTypeFromContentType(options.mediaMimeType)
        : inferMediaTypeFromPath(options.mediaPath);

      const fileBuffer = await fs.promises.readFile(options.mediaPath);
      const payload = { caption: String(options.caption || message || '') };

      if (mediaType === 'image') payload.image = fileBuffer;
      else if (mediaType === 'video') payload.video = fileBuffer;
      else if (mediaType === 'audio') {
        payload.audio = fileBuffer;
        payload.ptt = false;
      } else {
        payload.document = fileBuffer;
        payload.fileName = String(options.mediaFileName || path.basename(options.mediaPath));
      }

      const result = await socket.sendMessage(chatId, payload);
      return {
        id: result?.key?.id,
        timestamp: result?.messageTimestamp,
        to: chatId,
        body: message,
        status: 'sent',
      };
    }

    if (options.mediaUrl) {
      const response = await fetch(options.mediaUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch media URL (${response.status})`);
      }

      const mediaType = inferMediaTypeFromContentType(response.headers.get('content-type') || '');
      const fileBuffer = Buffer.from(await response.arrayBuffer());
      const payload = { caption: String(options.caption || message || '') };

      if (mediaType === 'image') payload.image = fileBuffer;
      else if (mediaType === 'video') payload.video = fileBuffer;
      else if (mediaType === 'audio') {
        payload.audio = fileBuffer;
        payload.ptt = false;
      } else {
        payload.document = fileBuffer;
      }

      const result = await socket.sendMessage(chatId, payload);
      return {
        id: result?.key?.id,
        timestamp: result?.messageTimestamp,
        to: chatId,
        body: message,
        status: 'sent',
      };
    }

    const result = await socket.sendMessage(chatId, { text: String(message || '') });
    return {
      id: result?.key?.id,
      timestamp: result?.messageTimestamp,
      to: chatId,
      body: message,
      status: 'sent',
    };
  }
}

module.exports = BaileysTransport;
