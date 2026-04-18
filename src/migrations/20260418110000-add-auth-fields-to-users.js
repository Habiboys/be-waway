'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'phone_number', {
      type: Sequelize.STRING(30),
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'address', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'email_verified_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'email_verification_token', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'email_verification_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'password_reset_token', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'password_reset_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addIndex('users', ['email_verification_token'], {
      name: 'users_email_verification_token_idx',
    });

    await queryInterface.addIndex('users', ['password_reset_token'], {
      name: 'users_password_reset_token_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'users_password_reset_token_idx');
    await queryInterface.removeIndex('users', 'users_email_verification_token_idx');

    await queryInterface.removeColumn('users', 'password_reset_expires_at');
    await queryInterface.removeColumn('users', 'password_reset_token');
    await queryInterface.removeColumn('users', 'email_verification_expires_at');
    await queryInterface.removeColumn('users', 'email_verification_token');
    await queryInterface.removeColumn('users', 'email_verified_at');
    await queryInterface.removeColumn('users', 'address');
    await queryInterface.removeColumn('users', 'phone_number');
  },
};
