const crypto = require('crypto');

const OTP_CODE_MIN = 4;
const OTP_CODE_MAX = 8;
const OTP_TTL_MIN = 60;
const OTP_TTL_MAX = 900;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeDestination = (destination, channel) => {
  const value = String(destination || '').trim();
  if (!value) return '';

  if (channel === 'email') {
    return value.toLowerCase();
  }

  return value.replace(/\s+/g, '');
};

const maskDestination = (destination, channel) => {
  const normalized = normalizeDestination(destination, channel);

  if (channel === 'email') {
    const [username, domain] = normalized.split('@');
    if (!username || !domain) return '***';
    if (username.length <= 2) return `${username[0] || '*'}***@${domain}`;
    return `${username.slice(0, 2)}***@${domain}`;
  }

  if (normalized.length <= 6) return '***';
  return `${normalized.slice(0, 4)}****${normalized.slice(-2)}`;
};

const hashOtpCode = (code) => {
  const pepper = process.env.OTP_PEPPER || process.env.JWT_SECRET || 'change-me';
  return crypto.createHash('sha256').update(`${String(code)}:${pepper}`).digest('hex');
};

const hashDestination = (destination) =>
  crypto.createHash('sha256').update(String(destination)).digest('hex');

const generateApiKey = (environment = 'sandbox') => {
  const prefix = environment === 'production' ? 'otp_live' : 'otp_test';
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
};

const hashApiKey = (apiKey) =>
  crypto.createHash('sha256').update(String(apiKey)).digest('hex');

const getApiKeyPrefix = (apiKey) => String(apiKey || '').slice(0, 12);

const maskApiKey = (apiKey, fallbackPrefix = '') => {
  const value = String(apiKey || '');
  if (value.length >= 16) {
    return `${value.slice(0, 10)}...${value.slice(-4)}`;
  }

  const prefix = String(fallbackPrefix || value || '');
  if (!prefix) return '***';
  return `${prefix}...`;
};

const generateOtpCode = (length = 6) => {
  const safeLength = clamp(Number(length) || 6, OTP_CODE_MIN, OTP_CODE_MAX);
  let code = '';

  for (let i = 0; i < safeLength; i += 1) {
    code += crypto.randomInt(0, 10).toString();
  }

  return code;
};

const normalizePolicy = (policy = {}, overrides = {}) => {
  const ttlSeconds = clamp(
    Number(overrides.ttl_seconds ?? policy.ttl_seconds ?? 300),
    OTP_TTL_MIN,
    OTP_TTL_MAX
  );
  const codeLength = clamp(
    Number(overrides.code_length ?? policy.code_length ?? 6),
    OTP_CODE_MIN,
    OTP_CODE_MAX
  );
  const maxAttempts = clamp(Number(policy.max_attempts ?? 5), 1, 15);
  const resendCooldownSeconds = clamp(Number(policy.resend_cooldown_seconds ?? 60), 10, 600);
  const maxResend = clamp(Number(policy.max_resend ?? 3), 0, 20);

  return {
    ttl_seconds: ttlSeconds,
    code_length: codeLength,
    max_attempts: maxAttempts,
    resend_cooldown_seconds: resendCooldownSeconds,
    max_resend: maxResend,
  };
};

const statusIsFinal = (status) => ['verified', 'expired', 'blocked', 'cancelled'].includes(status);

module.exports = {
  OTP_CODE_MIN,
  OTP_CODE_MAX,
  OTP_TTL_MIN,
  OTP_TTL_MAX,
  clamp,
  normalizeDestination,
  maskDestination,
  hashOtpCode,
  hashDestination,
  generateApiKey,
  hashApiKey,
  getApiKeyPrefix,
  maskApiKey,
  generateOtpCode,
  normalizePolicy,
  statusIsFinal,
};
