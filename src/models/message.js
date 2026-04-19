'use strict';

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    campaign_id: { type: DataTypes.UUID, allowNull: false },
    contact_id: { type: DataTypes.STRING(32), allowNull: false },
    phone_number: { type: DataTypes.STRING(30), allowNull: false },
    message: { type: DataTypes.TEXT('long'), allowNull: true },
    status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'queued' },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    sent_at: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'messages',
    timestamps: false
  });

  Message.associate = models => {
    Message.belongsTo(models.Campaign, { foreignKey: 'campaign_id', as: 'campaign' });
    Message.belongsTo(models.Contact, { foreignKey: 'contact_id', as: 'contact' });
  };

  return Message;
};
