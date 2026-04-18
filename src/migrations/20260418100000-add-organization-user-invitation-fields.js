'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('organization_users', 'invitation_status', {
      type: Sequelize.ENUM('pending', 'accepted', 'rejected'),
      allowNull: false,
      defaultValue: 'accepted',
    });

    await queryInterface.addColumn('organization_users', 'invited_by', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('organization_users', 'invited_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('organization_users', 'responded_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addIndex('organization_users', ['user_id', 'invitation_status'], {
      name: 'organization_users_user_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('organization_users', 'organization_users_user_status_idx');
    await queryInterface.removeColumn('organization_users', 'responded_at');
    await queryInterface.removeColumn('organization_users', 'invited_at');
    await queryInterface.removeColumn('organization_users', 'invited_by');
    await queryInterface.removeColumn('organization_users', 'invitation_status');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_organization_users_invitation_status";');
  },
};
