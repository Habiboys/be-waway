'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('otp_app_api_keys', 'api_key', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addColumn('otp_app_api_keys', 'api_key_hash', {
      type: Sequelize.STRING(128),
      allowNull: true,
    });

    await queryInterface.addColumn('otp_app_api_keys', 'key_prefix', {
      type: Sequelize.STRING(24),
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE otp_app_api_keys
      SET
        api_key_hash = SHA2(api_key, 256),
        key_prefix = SUBSTRING(api_key, 1, 12)
      WHERE api_key IS NOT NULL
        AND (api_key_hash IS NULL OR key_prefix IS NULL)
    `);

    await queryInterface.addIndex('otp_app_api_keys', ['api_key_hash'], {
      unique: true,
      name: 'otp_app_api_keys_api_key_hash_unique_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('otp_app_api_keys', 'otp_app_api_keys_api_key_hash_unique_idx');
    await queryInterface.removeColumn('otp_app_api_keys', 'key_prefix');
    await queryInterface.removeColumn('otp_app_api_keys', 'api_key_hash');

    await queryInterface.changeColumn('otp_app_api_keys', 'api_key', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });
  },
};
