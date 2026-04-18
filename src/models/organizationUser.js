'use strict';

module.exports = (sequelize, DataTypes) => {
  const OrganizationUser = sequelize.define('OrganizationUser', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    organization_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    role: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'member' },
    invitation_status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
      allowNull: false,
      defaultValue: 'accepted',
    },
    invited_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    invited_at: { type: DataTypes.DATE, allowNull: true },
    responded_at: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'organization_users',
    timestamps: false
  });

  OrganizationUser.associate = models => {
    OrganizationUser.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
    OrganizationUser.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    OrganizationUser.belongsTo(models.User, { foreignKey: 'invited_by', as: 'inviter' });
  };

  return OrganizationUser;
};
