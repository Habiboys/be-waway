'use strict';

module.exports = (sequelize, DataTypes) => {
  const ContactList = sequelize.define('ContactList', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(190), allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'contact_lists',
    timestamps: false
  });

  ContactList.associate = models => {
    ContactList.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    ContactList.hasMany(models.ContactListItem, { foreignKey: 'list_id', as: 'items' });
  };

  return ContactList;
};
