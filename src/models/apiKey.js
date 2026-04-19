'use strict';

module.exports = (sequelize, DataTypes) => {
  const ApiKey = sequelize.define('ApiKey', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    organization_id: { type: DataTypes.UUID, allowNull: false },
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
