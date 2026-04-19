'use strict';

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(190), allowNull: false, unique: true },
    phone_number: { type: DataTypes.STRING(30), allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'member'), allowNull: false, defaultValue: 'member' },
    email_verified_at: { type: DataTypes.DATE, allowNull: true },
    email_verification_token: { type: DataTypes.STRING(255), allowNull: true },
    email_verification_expires_at: { type: DataTypes.DATE, allowNull: true },
    password_reset_token: { type: DataTypes.STRING(255), allowNull: true },
    password_reset_expires_at: { type: DataTypes.DATE, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'users',
    timestamps: false
  });

  User.associate = models => {
    User.hasMany(models.Organization, { foreignKey: 'owner_id', as: 'ownedOrganizations' });
    User.hasMany(models.OrganizationUser, { foreignKey: 'user_id', as: 'organizationMemberships' });
  };

  return User;
};
