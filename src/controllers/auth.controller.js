const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { User, Organization, OrganizationUser, Plan, sequelize } = require('../models');
const { sendMail } = require('../services/mailService');
const {
  buildVerificationEmailTemplate,
  buildResetPasswordEmailTemplate,
} = require('../services/mailTemplateService');

const signToken = payload => jwt.sign(
  {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    organization_id: payload.organization_id || payload.organizationId || null,
  },
  process.env.JWT_SECRET || 'change-me',
  { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
);

const sanitizeUser = (user, extra = {}) => {
  const data = user.toJSON ? user.toJSON() : user;
  // eslint-disable-next-line no-unused-vars
  const {
    password,
    email_verification_token,
    email_verification_expires_at,
    password_reset_token,
    password_reset_expires_at,
    ...safe
  } = data;
  return { ...safe, ...extra };
};

const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

const createRawToken = () => crypto.randomBytes(32).toString('hex');

const getFrontendBaseUrl = () =>
  process.env.FRONTEND_BASE_URL || 'http://localhost:5173';

const sendVerificationEmail = async (user, rawToken) => {
  const verifyUrl = `${getFrontendBaseUrl().replace(/\/$/, '')}/verify-email?token=${rawToken}`;
  const mail = buildVerificationEmailTemplate({
    name: user.name,
    verifyUrl,
  });

  await sendMail({
    to: user.email,
    ...mail,
  });
};

const sendResetPasswordEmail = async (user, rawToken) => {
  const resetUrl = `${getFrontendBaseUrl().replace(/\/$/, '')}/reset-password?token=${rawToken}`;
  const mail = buildResetPasswordEmailTemplate({
    name: user.name,
    resetUrl,
  });

  await sendMail({
    to: user.email,
    ...mail,
  });
};

const getPrimaryOrganizationId = async (userId) => {
  const membership = await OrganizationUser.findOne({
    where: { user_id: userId },
    order: [['id', 'ASC']],
  });

  return membership ? membership.organization_id : null;
};

exports.register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone_number,
    address,
    password,
    confirm_password,
    organization_name,
  } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email, and password are required' });
  }

  if (!phone_number || !address) {
    return res.status(400).json({ message: 'phone_number and address are required' });
  }

  if (confirm_password !== undefined && password !== confirm_password) {
    return res.status(400).json({ message: 'Password confirmation does not match' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const exists = await User.findOne({ where: { email } });
  if (exists) return res.status(409).json({ message: 'Email already registered' });

  const result = await sequelize.transaction(async (transaction) => {
    const hashedPassword = await bcrypt.hash(password, 10);
    const rawVerificationToken = createRawToken();
    const user = await User.create({
      name,
      email: String(email).toLowerCase(),
      phone_number: String(phone_number).trim(),
      address: String(address).trim(),
      password: hashedPassword,
      role: 'member',
      email_verified_at: null,
      email_verification_token: hashToken(rawVerificationToken),
      email_verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }, { transaction });

    const orgName = String(organization_name || `${name}'s Organization`).trim();
    const organization = await Organization.create({
      name: orgName || `${name}'s Organization`,
      owner_id: user.id,
    }, { transaction });

    await OrganizationUser.create({
      organization_id: organization.id,
      user_id: user.id,
      role: 'owner',
      invitation_status: 'accepted',
      invited_by: user.id,
      invited_at: new Date(),
      responded_at: new Date(),
    }, { transaction });

    return {
      user,
      organizationId: organization.id,
      verificationToken: rawVerificationToken,
    };
  });

  await sendVerificationEmail(result.user, result.verificationToken);

  res.status(201).json({
    user: sanitizeUser(result.user, { organization_id: result.organizationId }),
    email_verified: false,
    message: 'Register success. Please verify your email.',
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const user = await User.findOne({ where: { email: String(email).toLowerCase() } });

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (user.deleted_at) {
    return res.status(403).json({ message: 'Account has been deactivated' });
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (!user.email_verified_at) {
    return res.status(403).json({
      message: 'Email belum diverifikasi. Silakan cek inbox untuk verifikasi.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  const organizationId = await getPrimaryOrganizationId(user.id);
  const token = signToken({ ...user.toJSON(), organization_id: organizationId });
  return res.json({
    token,
    user: sanitizeUser(user, { organization_id: organizationId }),
    email_verified: Boolean(user.email_verified_at),
  });
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const organizationId = req.user.organization_id || await getPrimaryOrganizationId(user.id);
  return res.json({ ...user.toJSON(), organization_id: organizationId });
});

exports.logout = asyncHandler(async (req, res) => {
  return res.json({ message: 'Logged out' });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ message: 'email is required' });
  }

  const user = await User.findOne({ where: { email } });
  if (!user || user.deleted_at) {
    return res.json({ message: 'If email is registered, reset link will be sent.' });
  }

  const rawToken = createRawToken();
  await user.update({
    password_reset_token: hashToken(rawToken),
    password_reset_expires_at: new Date(Date.now() + 30 * 60 * 1000),
  });

  await sendResetPasswordEmail(user, rawToken);

  return res.json({ message: 'If email is registered, reset link will be sent.' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password, confirm_password } = req.body || {};

  if (!token || !password) {
    return res.status(400).json({ message: 'token and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  if (confirm_password !== undefined && password !== confirm_password) {
    return res.status(400).json({ message: 'Password confirmation does not match' });
  }

  const hashedToken = hashToken(token);
  const user = await User.findOne({
    where: {
      password_reset_token: hashedToken,
      password_reset_expires_at: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired reset token' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await user.update({
    password: hashedPassword,
    password_reset_token: null,
    password_reset_expires_at: null,
  });

  return res.json({ message: 'Password has been reset successfully' });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const token = String(req.query?.token || req.body?.token || '').trim();
  if (!token) {
    return res.status(400).json({ message: 'token is required' });
  }

  const hashedToken = hashToken(token);
  const user = await User.findOne({
    where: {
      email_verification_token: hashedToken,
    },
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired verification token' });
  }

  if (user.email_verified_at) {
    return res.json({ message: 'Email already verified' });
  }

  if (
    !user.email_verification_expires_at ||
    new Date(user.email_verification_expires_at).getTime() <= Date.now()
  ) {
    return res.status(400).json({ message: 'Invalid or expired verification token' });
  }

  await user.update({
    email_verified_at: new Date(),
  });

  return res.json({ message: 'Email verified successfully' });
});

exports.resendVerification = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ message: 'email is required' });
  }

  const user = await User.findOne({ where: { email } });
  if (!user || user.deleted_at) {
    return res.json({ message: 'If account exists, verification email has been sent.' });
  }

  if (user.email_verified_at) {
    return res.json({ message: 'Email is already verified.' });
  }

  const rawToken = createRawToken();
  await user.update({
    email_verification_token: hashToken(rawToken),
    email_verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await sendVerificationEmail(user, rawToken);

  return res.json({ message: 'If account exists, verification email has been sent.' });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user || user.deleted_at) {
    return res.status(404).json({ message: 'User not found' });
  }

  const name = req.body?.name !== undefined ? String(req.body.name).trim() : user.name;
  const phoneNumber = req.body?.phone_number !== undefined
    ? String(req.body.phone_number).trim()
    : (user.phone_number || null);
  const address = req.body?.address !== undefined ? String(req.body.address).trim() : (user.address || null);
  const nextEmail = req.body?.email !== undefined
    ? String(req.body.email).toLowerCase().trim()
    : String(user.email).toLowerCase();

  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  if (!nextEmail) {
    return res.status(400).json({ message: 'email is required' });
  }

  const currentEmail = String(user.email).toLowerCase();
  const isEmailChanged = nextEmail !== currentEmail;

  if (isEmailChanged) {
    const exists = await User.findOne({
      where: {
        email: nextEmail,
        id: { [Op.ne]: user.id },
      },
    });

    if (exists) {
      return res.status(409).json({ message: 'Email already registered' });
    }
  }

  let verificationToken = null;
  if (isEmailChanged) {
    verificationToken = createRawToken();
  }

  await user.update({
    name,
    email: nextEmail,
    phone_number: phoneNumber || null,
    address: address || null,
    ...(isEmailChanged
      ? {
          email_verified_at: null,
          email_verification_token: hashToken(verificationToken),
          email_verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }
      : {}),
  });

  if (isEmailChanged) {
    await sendVerificationEmail(user, verificationToken);
  }

  const organizationId = await getPrimaryOrganizationId(user.id);

  return res.json({
    user: sanitizeUser(user, { organization_id: organizationId }),
    requires_reverification: isEmailChanged,
    message: isEmailChanged
      ? 'Profile updated. Please verify your new email address.'
      : 'Profile updated successfully',
  });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const {
    current_password,
    new_password,
    confirm_password,
  } = req.body || {};

  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'current_password and new_password are required' });
  }

  if (String(new_password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  if (confirm_password !== undefined && String(confirm_password) !== String(new_password)) {
    return res.status(400).json({ message: 'Password confirmation does not match' });
  }

  const user = await User.findByPk(req.user.id);
  if (!user || user.deleted_at) {
    return res.status(404).json({ message: 'User not found' });
  }

  const isCurrentPasswordValid = await bcrypt.compare(String(current_password), user.password);
  if (!isCurrentPasswordValid) {
    return res.status(400).json({ message: 'Current password is incorrect' });
  }

  const nextHash = await bcrypt.hash(String(new_password), 10);
  await user.update({
    password: nextHash,
    password_reset_token: null,
    password_reset_expires_at: null,
  });

  return res.json({ message: 'Password updated successfully' });
});

exports.publicPlans = asyncHandler(async (_req, res) => {
  const plans = await Plan.findAll({
    order: [['price', 'ASC']],
  });

  return res.json(plans);
});
