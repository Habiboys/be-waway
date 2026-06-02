const WA_STATUSES = Object.freeze({
  OFFLINE: 'offline',
  CONNECTING: 'connecting',
  QR_PENDING: 'qr_pending',
  AUTHENTICATED: 'authenticated',
  READY: 'ready',
  DISCONNECTED: 'disconnected',
  AUTH_FAILURE: 'auth_failure',
});

const WA_SOCKET_EVENTS = Object.freeze({
  STATUS: 'device:status',
  BULK_PROGRESS: 'device:bulk_progress',
  BULK_COMPLETE: 'device:bulk_complete',
  ALL_STATUSES: 'device:all_statuses',
});

const WA_TRANSPORT_METHODS = Object.freeze([
  'connectDevice(deviceId, lifecycle)',
  'disconnectDevice(deviceId, options)',
  'getSession(deviceId)',
  'hasSession(deviceId)',
  'isRegisteredUser(deviceId, phone)',
  'sendMessage(deviceId, phone, message, options)',
]);

module.exports = {
  WA_STATUSES,
  WA_SOCKET_EVENTS,
  WA_TRANSPORT_METHODS,
};
