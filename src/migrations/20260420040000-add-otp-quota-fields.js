'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add otp_limit to plans (0 = no OTP quota, null = unlimited)
    await queryInterface.addColumn('plans', 'otp_limit', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'OTP quota per cycle. 0 = no OTP allowed, -1 = unlimited',
    });

    // Add otp_sent to usage_logs for daily OTP tracking
    await queryInterface.addColumn('usage_logs', 'otp_sent', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('plans', 'otp_limit');
    await queryInterface.removeColumn('usage_logs', 'otp_sent');
  },
};
