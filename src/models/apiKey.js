'use strict';

module.exports = (sequelize, DataTypes) => {
  const ApiKey = sequelize.define('ApiKey', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    api_key: { type: DataTypes.STRING(255), allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false }
  }, {
    tableName: 'api_keys',
    timestamps: false
  });

  ApiKey.associate = models => {
    ApiKey.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
  };

  return ApiKey;
};
