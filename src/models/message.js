'use strict';

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    campaign_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    contact_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
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
