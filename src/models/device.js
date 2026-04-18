'use strict';

module.exports = (sequelize, DataTypes) => {
  const Device = sequelize.define('Device', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    device_name: { type: DataTypes.STRING(150), allowNull: false },
    phone_number: { type: DataTypes.STRING(30), allowNull: true },
    status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'offline' },
    session_data: { type: DataTypes.TEXT('long'), allowNull: true },
    last_seen: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'devices',
    timestamps: false
  });

  Device.associate = models => {
    Device.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    Device.hasMany(models.Campaign, { foreignKey: 'device_id', as: 'campaigns' });
  };

  return Device;
};
