'use strict';

const DEFAULT_OTP_TEMPLATE = 'Kode OTP Anda: {{code}}. Berlaku {{ttl}} menit. Jangan bagikan kode ini ke siapapun.';

module.exports = (sequelize, DataTypes) => {
  const OtpApp = sequelize.define('OtpApp', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(80), allowNull: false },
    environment: { type: DataTypes.ENUM('sandbox', 'production'), allowNull: false, defaultValue: 'sandbox' },
    default_channel: { type: DataTypes.ENUM('whatsapp', 'sms', 'email'), allowNull: false, defaultValue: 'whatsapp' },
    device_id: { type: DataTypes.STRING(16), allowNull: true },
    message_template: { type: DataTypes.TEXT, allowNull: true, defaultValue: DEFAULT_OTP_TEMPLATE },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'otp_apps',
    timestamps: false,
  });

  OtpApp.associate = models => {
    OtpApp.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    OtpApp.belongsTo(models.Device, { foreignKey: 'device_id', as: 'device' });
    OtpApp.hasMany(models.OtpAppApiKey, { foreignKey: 'otp_app_id', as: 'apiKeys' });
    OtpApp.hasOne(models.OtpAppPolicy, { foreignKey: 'otp_app_id', as: 'policy' });
    OtpApp.hasMany(models.OtpTransaction, { foreignKey: 'otp_app_id', as: 'transactions' });
  };

  OtpApp.DEFAULT_OTP_TEMPLATE = DEFAULT_OTP_TEMPLATE;

  return OtpApp;
};
