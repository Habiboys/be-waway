'use strict';

const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const defaultAdminId = '00000000-0000-4000-8000-000000000001';

    await queryInterface.bulkInsert('users', [
      {
        id: defaultAdminId,
        name: 'Super Admin',
        email: 'admin@waway.com',
        password: passwordHash,
        role: 'admin',
        created_at: new Date()
      }
    ], {
      ignoreDuplicates: true
    });

    await queryInterface.bulkUpdate('users',
      {
        id: defaultAdminId,
        name: 'Super Admin',
        password: passwordHash,
        role: 'admin',
      },
      {
        email: 'admin@waway.com',
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      email: 'admin@waway.com'
    });
  }
};
