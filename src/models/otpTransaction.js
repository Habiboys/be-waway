'use strict';

module.exports = (sequelize, DataTypes) => {
  const OtpTransaction = sequelize.define('OtpTransaction', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    otp_app_id: { type: DataTypes.UUID, allowNull: false },
    api_key_id: { type: DataTypes.UUID, allowNull: true },
    channel: { type: DataTypes.ENUM('whatsapp', 'sms', 'email'), allowNull: false },
    purpose: { type: DataTypes.STRING(30), allowNull: false },
    destination: { type: DataTypes.STRING(190), allowNull: false },
    destination_hash: { type: DataTypes.STRING(128), allowNull: false },
    destination_masked: { type: DataTypes.STRING(190), allowNull: false },
    reference_id: { type: DataTypes.STRING(100), allowNull: true },
    code_hash: { type: DataTypes.STRING(128), allowNull: false },
    status: {
      type: DataTypes.ENUM('created', 'sent', 'verified', 'expired', 'blocked', 'cancelled', 'failed'),
      allowNull: false,
      defaultValue: 'created',
    },
    attempt_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    resend_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    max_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
    max_resend: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    next_resend_at: { type: DataTypes.DATE, allowNull: false },
    verified_at: { type: DataTypes.DATE, allowNull: true },
    used_at: { type: DataTypes.DATE, allowNull: true },
    cancelled_at: { type: DataTypes.DATE, allowNull: true },
    blocked_until: { type: DataTypes.DATE, allowNull: true },
    idempotency_key: { type: DataTypes.STRING(120), allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'otp_transactions',
    timestamps: false,
  });

  OtpTransaction.associate = models => {
    OtpTransaction.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    OtpTransaction.belongsTo(models.OtpApp, { foreignKey: 'otp_app_id', as: 'app' });
    OtpTransaction.belongsTo(models.OtpAppApiKey, { foreignKey: 'api_key_id', as: 'apiKey' });
  };

  return OtpTransaction;
};
