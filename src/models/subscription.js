'use strict';

module.exports = (sequelize, DataTypes) => {
  const Subscription = sequelize.define('Subscription', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    plan_id: { type: DataTypes.UUID, allowNull: false },
    start_date: { type: DataTypes.DATE, allowNull: false },
    end_date: { type: DataTypes.DATE, allowNull: false },
    status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'active' }
  }, {
    tableName: 'subscriptions',
    timestamps: false
  });

  Subscription.associate = models => {
    Subscription.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    Subscription.belongsTo(models.Plan, { foreignKey: 'plan_id', as: 'plan' });
    Subscription.hasMany(models.Payment, { foreignKey: 'subscription_id', as: 'payments' });
  };

  return Subscription;
};
