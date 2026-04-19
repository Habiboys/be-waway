'use strict';

const crypto = require('crypto');

const createContactId = () => `ctc_${crypto.randomBytes(6).toString('hex')}`;

module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define('Contact', {
    id: { type: DataTypes.STRING(32), allowNull: false, primaryKey: true, defaultValue: createContactId },
    organization_id: { type: DataTypes.UUID, allowNull: false },
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
