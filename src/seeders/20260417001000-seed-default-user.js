'use strict';

const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const passwordHash = await bcrypt.hash('admin123', 10);

    await queryInterface.bulkInsert('users', [
      {
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
