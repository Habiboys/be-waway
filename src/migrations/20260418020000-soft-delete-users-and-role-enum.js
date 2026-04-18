'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      "UPDATE users SET deleted_at = COALESCE(deleted_at, NOW()) WHERE role = 'inactive'"
    );

    await queryInterface.sequelize.query(
      "UPDATE users SET role = 'member' WHERE role IS NULL OR role NOT IN ('admin','member')"
    );

    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM('admin', 'member'),
      allowNull: false,
      defaultValue: 'member',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'member',
    });

    await queryInterface.removeColumn('users', 'deleted_at');
  },
};
