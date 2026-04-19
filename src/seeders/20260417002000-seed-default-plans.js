'use strict';

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const DEFAULT_PLAN_IDS = {
      trial: '00000000-0000-4000-8000-000000000101',
      starter: '00000000-0000-4000-8000-000000000102',
      pro: '00000000-0000-4000-8000-000000000103',
    };

    await queryInterface.bulkInsert('plans', [
      {
        id: DEFAULT_PLAN_IDS.trial,
        name: 'Trial',
        description: 'Paket gratis untuk mencoba fitur dasar blast WhatsApp.',
        price: 0,
        message_limit: 100,
        device_limit: 1,
        duration_days: 30,
        created_at: now,
      },
      {
        id: DEFAULT_PLAN_IDS.starter,
        name: 'Starter',
        description: 'Cocok untuk bisnis kecil dengan kebutuhan broadcast rutin.',
        price: 149000,
        message_limit: 10000,
        device_limit: 3,
        duration_days: 30,
        created_at: now,
      },
      {
        id: DEFAULT_PLAN_IDS.pro,
        name: 'Pro',
        description: 'Untuk kebutuhan volume besar dan operasional tim.',
        price: 349000,
        message_limit: 50000,
        device_limit: 10,
        duration_days: 30,
        created_at: now,
      },
    ], {
      ignoreDuplicates: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('plans', {
      name: ['Trial', 'Starter', 'Pro'],
    });
  }
};
