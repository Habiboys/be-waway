const otpService = require('../services/otpService');

const WINDOW_MS = 60 * 1000;
const store = new Map();

const DEFAULT_LIMITS = {
  apiKey: Number(process.env.OTP_RATE_LIMIT_PER_API_KEY || 120),
  ip: Number(process.env.OTP_RATE_LIMIT_PER_IP || 240),
  destination: Number(process.env.OTP_RATE_LIMIT_PER_DESTINATION || 10),
};

const getClientIp = (req) => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwardedFor || req.ip || req.socket?.remoteAddress || 'unknown';
};

const checkBucket = (bucketKey, limit, now = Date.now()) => {
  const current = store.get(bucketKey);

  if (!current || now >= current.resetAt) {
    const next = {
      count: 1,
      resetAt: now + WINDOW_MS,
    };
    store.set(bucketKey, next);
    return {
      allowed: true,
      remaining: Math.max(0, limit - next.count),
      retryAfter: 0,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;
  store.set(bucketKey, current);
  return {
    allowed: true,
    remaining: Math.max(0, limit - current.count),
    retryAfter: 0,
  };
};

const rejectRateLimit = (res, key, info) => {
  return res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: `Rate limit exceeded for ${key}`,
      details: {
        retry_after_seconds: info.retryAfter,
        remaining: info.remaining,
      },
    },
  });
};

const applyLimit = (res, key, bucketKey, limit) => {
  const info = checkBucket(bucketKey, Math.max(1, Number(limit) || 1));
  if (!info.allowed) {
    return rejectRateLimit(res, key, info);
  }

  return null;
};

const send = (req, res, next) => {
  const apiKey = String(req.headers['x-api-key'] || '').trim();
  const ip = getClientIp(req);
  const destination = otpService.normalizeDestination(req.body?.destination, req.body?.channel || '');

  const blockedByApiKey = applyLimit(res, 'api_key', `otp:send:api_key:${apiKey}`, DEFAULT_LIMITS.apiKey);
  if (blockedByApiKey) return blockedByApiKey;

  const blockedByIp = applyLimit(res, 'ip', `otp:send:ip:${ip}`, DEFAULT_LIMITS.ip);
  if (blockedByIp) return blockedByIp;

  if (destination) {
    const destinationHash = otpService.hashDestination(destination);
    const blockedByDestination = applyLimit(
      res,
      'destination',
      `otp:send:dest:${destinationHash}`,
      DEFAULT_LIMITS.destination
    );
    if (blockedByDestination) return blockedByDestination;
  }

  return next();
};

const verifyLike = (req, res, next) => {
  const apiKey = String(req.headers['x-api-key'] || '').trim();
  const ip = getClientIp(req);

  const blockedByApiKey = applyLimit(res, 'api_key', `otp:verify:api_key:${apiKey}`, DEFAULT_LIMITS.apiKey);
  if (blockedByApiKey) return blockedByApiKey;

  const blockedByIp = applyLimit(res, 'ip', `otp:verify:ip:${ip}`, DEFAULT_LIMITS.ip);
  if (blockedByIp) return blockedByIp;

  return next();
};

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now >= value.resetAt) {
      store.delete(key);
    }
  }
}, WINDOW_MS).unref();

module.exports = {
  send,
  verifyLike,
};
