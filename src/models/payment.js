'use strict';

module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('Payment', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    subscription_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'IDR' },
    status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'pending' },
    payment_gateway: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'xendit' },
    transaction_id: { type: DataTypes.STRING(190), allowNull: true },
    external_id: { type: DataTypes.STRING(190), allowNull: false },
    xendit_invoice_id: { type: DataTypes.STRING(190), allowNull: true },
    xendit_payment_id: { type: DataTypes.STRING(190), allowNull: true },
    xendit_payment_method: { type: DataTypes.STRING(100), allowNull: true },
    xendit_payment_channel: { type: DataTypes.STRING(100), allowNull: true },
    xendit_webhook_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    paid_at: { type: DataTypes.DATE, allowNull: true },
    expired_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false }
  }, {
    tableName: 'payments',
    timestamps: false
  });

  Payment.associate = models => {
    Payment.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    Payment.belongsTo(models.Subscription, { foreignKey: 'subscription_id', as: 'subscription' });
    Payment.hasMany(models.PaymentLog, { foreignKey: 'payment_id', as: 'logs' });
  };

  return Payment;
};
