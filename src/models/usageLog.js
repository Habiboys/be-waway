'use strict';

module.exports = (sequelize, DataTypes) => {
  const UsageLog = sequelize.define('UsageLog', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    messages_sent: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    date: { type: DataTypes.DATEONLY, allowNull: false }
  }, {
    tableName: 'usage_logs',
    timestamps: false
  });

  UsageLog.associate = models => {
    UsageLog.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
  };

  return UsageLog;
};
