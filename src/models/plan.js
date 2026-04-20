'use strict';

module.exports = (sequelize, DataTypes) => {
  const Plan = sequelize.define('Plan', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    price: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    message_limit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    device_limit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    otp_limit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    duration_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'plans',
    timestamps: false
  });

  Plan.associate = models => {
    Plan.hasMany(models.Subscription, { foreignKey: 'plan_id', as: 'subscriptions' });
    Plan.hasMany(models.Payment, { foreignKey: 'plan_id', as: 'payments' });
  };

  return Plan;
};
