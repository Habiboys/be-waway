'use strict';

const crypto = require('crypto');

const createDeviceId = () => crypto.randomBytes(6).toString('hex');

module.exports = (sequelize, DataTypes) => {
  const Device = sequelize.define('Device', {
    id: { type: DataTypes.STRING(16), allowNull: false, primaryKey: true, defaultValue: createDeviceId },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    device_name: { type: DataTypes.STRING(150), allowNull: false },
    phone_number: { type: DataTypes.STRING(30), allowNull: true },
    status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'offline' },
    session_data: { type: DataTypes.TEXT('long'), allowNull: true },
    last_seen: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'devices',
    timestamps: false,
    hooks: {
      beforeValidate: (device) => {
        if (!device.id) {
          device.id = createDeviceId();
        }
      },
    },
  });

  Device.associate = models => {
    Device.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    Device.hasMany(models.Campaign, { foreignKey: 'device_id', as: 'campaigns' });
  };

  return Device;
};
