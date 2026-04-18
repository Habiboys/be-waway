'use strict';

module.exports = (sequelize, DataTypes) => {
  const Organization = sequelize.define('Organization', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(190), allowNull: false },
    owner_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'organizations',
    timestamps: false
  });

  Organization.associate = models => {
    Organization.belongsTo(models.User, { foreignKey: 'owner_id', as: 'owner' });
    Organization.hasMany(models.OrganizationUser, { foreignKey: 'organization_id', as: 'memberships' });
    Organization.hasMany(models.Device, { foreignKey: 'organization_id', as: 'devices' });
    Organization.hasMany(models.Contact, { foreignKey: 'organization_id', as: 'contacts' });
    Organization.hasMany(models.ContactList, { foreignKey: 'organization_id', as: 'contactLists' });
    Organization.hasMany(models.Campaign, { foreignKey: 'organization_id', as: 'campaigns' });
    Organization.hasMany(models.Subscription, { foreignKey: 'organization_id', as: 'subscriptions' });
    Organization.hasMany(models.Payment, { foreignKey: 'organization_id', as: 'payments' });
    Organization.hasMany(models.UsageLog, { foreignKey: 'organization_id', as: 'usageLogs' });
    Organization.hasMany(models.ApiKey, { foreignKey: 'organization_id', as: 'apiKeys' });
  };

  return Organization;
};
