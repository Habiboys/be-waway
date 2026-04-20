'use strict';

module.exports = (sequelize, DataTypes) => {
  const OtpAppPolicy = sequelize.define('OtpAppPolicy', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    otp_app_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    ttl_seconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 300 },
    code_length: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 6 },
    max_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
    resend_cooldown_seconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
    max_resend: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    rate_limit_per_minute: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'otp_app_policies',
    timestamps: false,
  });

  OtpAppPolicy.associate = models => {
    OtpAppPolicy.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    OtpAppPolicy.belongsTo(models.OtpApp, { foreignKey: 'otp_app_id', as: 'app' });
  };

  return OtpAppPolicy;
};
