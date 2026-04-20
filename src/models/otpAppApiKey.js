'use strict';

module.exports = (sequelize, DataTypes) => {
  const OtpAppApiKey = sequelize.define('OtpAppApiKey', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    otp_app_id: { type: DataTypes.UUID, allowNull: false },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    api_key: { type: DataTypes.STRING(255), allowNull: true },
    api_key_hash: { type: DataTypes.STRING(128), allowNull: true },
    key_prefix: { type: DataTypes.STRING(24), allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    last_used_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'otp_app_api_keys',
    timestamps: false,
  });

  OtpAppApiKey.associate = models => {
    OtpAppApiKey.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    OtpAppApiKey.belongsTo(models.OtpApp, { foreignKey: 'otp_app_id', as: 'app' });
    OtpAppApiKey.hasMany(models.OtpTransaction, { foreignKey: 'api_key_id', as: 'transactions' });
  };

  return OtpAppApiKey;
};
