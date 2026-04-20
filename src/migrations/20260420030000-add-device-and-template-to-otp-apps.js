'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('otp_apps', 'device_id', {
      type: Sequelize.STRING(16),
      allowNull: true,
      references: { model: 'devices', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('otp_apps', 'message_template', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: 'Kode OTP Anda: {{code}}. Berlaku {{ttl}} menit. Jangan bagikan kode ini ke siapapun.',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('otp_apps', 'device_id');
    await queryInterface.removeColumn('otp_apps', 'message_template');
  },
};
