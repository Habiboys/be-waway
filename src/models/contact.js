'use strict';

module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define('Contact', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(190), allowNull: false },
    phone_number: { type: DataTypes.STRING(30), allowNull: false },
    custom_fields: { type: DataTypes.JSON, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'contacts',
    timestamps: false
  });

  Contact.associate = models => {
    Contact.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    Contact.hasMany(models.ContactListItem, { foreignKey: 'contact_id', as: 'listItems' });
    Contact.hasMany(models.Message, { foreignKey: 'contact_id', as: 'messages' });
  };

  return Contact;
};
