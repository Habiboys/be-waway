'use strict';

module.exports = (sequelize, DataTypes) => {
  const PaymentLog = sequelize.define('PaymentLog', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    payment_id: { type: DataTypes.STRING(32), allowNull: false },
    event_type: { type: DataTypes.STRING(100), allowNull: true },
    event_id: { type: DataTypes.STRING(190), allowNull: true },
    payload: { type: DataTypes.JSON, allowNull: false },
    status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'received' },
    created_at: { type: DataTypes.DATE, allowNull: false }
  }, {
    tableName: 'payment_logs',
    timestamps: false
  });

  PaymentLog.associate = models => {
    PaymentLog.belongsTo(models.Payment, { foreignKey: 'payment_id', as: 'payment' });
  };

  return PaymentLog;
};
