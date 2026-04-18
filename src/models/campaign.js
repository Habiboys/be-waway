'use strict';

module.exports = (sequelize, DataTypes) => {
  const Campaign = sequelize.define('Campaign', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    device_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    name: { type: DataTypes.STRING(190), allowNull: false },
    message: { type: DataTypes.TEXT('long'), allowNull: true },
    media_url: { type: DataTypes.STRING(500), allowNull: true },
    scheduled_at: { type: DataTypes.DATE, allowNull: true },
    status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'draft' },
    created_at: { type: DataTypes.DATE, allowNull: false }
  }, {
    tableName: 'campaigns',
    timestamps: false
  });

  Campaign.associate = models => {
    Campaign.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    Campaign.belongsTo(models.Device, { foreignKey: 'device_id', as: 'device' });
    Campaign.hasMany(models.Message, { foreignKey: 'campaign_id', as: 'messages' });
  };

  return Campaign;
};
