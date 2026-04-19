'use strict';

module.exports = (sequelize, DataTypes) => {
  const ContactListItem = sequelize.define('ContactListItem', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    list_id: { type: DataTypes.UUID, allowNull: false },
    contact_id: { type: DataTypes.STRING(32), allowNull: false }
  }, {
    tableName: 'contact_list_items',
    timestamps: false
  });

  ContactListItem.associate = models => {
    ContactListItem.belongsTo(models.ContactList, { foreignKey: 'list_id', as: 'list' });
    ContactListItem.belongsTo(models.Contact, { foreignKey: 'contact_id', as: 'contact' });
  };

  return ContactListItem;
};
