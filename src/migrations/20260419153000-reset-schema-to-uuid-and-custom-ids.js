'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, TEXT, DATE, DATEONLY, INTEGER, DECIMAL, BOOLEAN, JSON, ENUM } = Sequelize;

    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

    const tables = [
      'template_messages',
      'api_keys',
      'usage_logs',
      'payment_logs',
      'payments',
      'subscriptions',
      'plans',
      'jobs',
      'messages',
      'campaigns',
      'contact_list_items',
      'contact_lists',
      'contacts',
      'devices',
      'organization_users',
      'organizations',
      'users',
    ];

    for (const tableName of tables) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.dropTable(tableName).catch(() => {});
    }

    await queryInterface.createTable('users', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      name: { type: STRING(150), allowNull: false },
      email: { type: STRING(190), allowNull: false, unique: true },
      phone_number: { type: STRING(30), allowNull: true },
      address: { type: TEXT, allowNull: true },
      password: { type: STRING(255), allowNull: false },
      role: { type: ENUM('admin', 'member'), allowNull: false, defaultValue: 'member' },
      email_verified_at: { type: DATE, allowNull: true },
      email_verification_token: { type: STRING(255), allowNull: true },
      email_verification_expires_at: { type: DATE, allowNull: true },
      password_reset_token: { type: STRING(255), allowNull: true },
      password_reset_expires_at: { type: DATE, allowNull: true },
      deleted_at: { type: DATE, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('organizations', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      name: { type: STRING(190), allowNull: false },
      owner_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('organization_users', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role: { type: STRING(50), allowNull: false, defaultValue: 'member' },
      invitation_status: { type: ENUM('pending', 'accepted', 'rejected'), allowNull: false, defaultValue: 'accepted' },
      invited_by: {
        type: UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      invited_at: { type: DATE, allowNull: true },
      responded_at: { type: DATE, allowNull: true },
    });

    await queryInterface.createTable('devices', {
      id: { type: STRING(16), allowNull: false, primaryKey: true },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      device_name: { type: STRING(150), allowNull: false },
      phone_number: { type: STRING(30), allowNull: true },
      status: { type: STRING(50), allowNull: false, defaultValue: 'offline' },
      session_data: { type: TEXT('long'), allowNull: true },
      last_seen: { type: DATE, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('contacts', {
      id: { type: STRING(32), allowNull: false, primaryKey: true },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: { type: STRING(190), allowNull: false },
      phone_number: { type: STRING(30), allowNull: false },
      custom_fields: { type: JSON, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('contact_lists', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: { type: STRING(190), allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('contact_list_items', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      list_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'contact_lists', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      contact_id: {
        type: STRING(32),
        allowNull: false,
        references: { model: 'contacts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    });

    await queryInterface.createTable('campaigns', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      device_id: {
        type: STRING(16),
        allowNull: true,
        references: { model: 'devices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      name: { type: STRING(190), allowNull: false },
      message: { type: TEXT('long'), allowNull: true },
      media_url: { type: STRING(500), allowNull: true },
      scheduled_at: { type: DATE, allowNull: true },
      status: { type: STRING(50), allowNull: false, defaultValue: 'draft' },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('messages', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      campaign_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'campaigns', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      contact_id: {
        type: STRING(32),
        allowNull: false,
        references: { model: 'contacts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      phone_number: { type: STRING(30), allowNull: false },
      message: { type: TEXT('long'), allowNull: true },
      status: { type: STRING(50), allowNull: false, defaultValue: 'queued' },
      error_message: { type: TEXT, allowNull: true },
      sent_at: { type: DATE, allowNull: true },
    });

    await queryInterface.createTable('jobs', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      type: { type: STRING(100), allowNull: false },
      payload: { type: JSON, allowNull: true },
      status: { type: STRING(50), allowNull: false, defaultValue: 'pending' },
      attempts: { type: INTEGER, allowNull: false, defaultValue: 0 },
      run_at: { type: DATE, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('plans', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      name: { type: STRING(100), allowNull: false },
      description: { type: TEXT, allowNull: true },
      price: { type: DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      message_limit: { type: INTEGER, allowNull: false, defaultValue: 0 },
      device_limit: { type: INTEGER, allowNull: false, defaultValue: 1 },
      duration_days: { type: INTEGER, allowNull: false, defaultValue: 30 },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('subscriptions', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      plan_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'plans', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      start_date: { type: DATE, allowNull: false },
      end_date: { type: DATE, allowNull: false },
      status: { type: STRING(50), allowNull: false, defaultValue: 'active' },
    });

    await queryInterface.createTable('payments', {
      id: { type: STRING(32), allowNull: false, primaryKey: true },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      plan_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'plans', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      subscription_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'subscriptions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      amount: { type: DECIMAL(15, 2), allowNull: false },
      currency: { type: STRING(10), allowNull: false, defaultValue: 'IDR' },
      status: { type: STRING(50), allowNull: false, defaultValue: 'pending' },
      payment_gateway: { type: STRING(50), allowNull: false, defaultValue: 'xendit' },
      transaction_id: { type: STRING(190), allowNull: true },
      external_id: { type: STRING(190), allowNull: false },
      xendit_invoice_id: { type: STRING(190), allowNull: true },
      xendit_payment_id: { type: STRING(190), allowNull: true },
      xendit_payment_method: { type: STRING(100), allowNull: true },
      xendit_payment_channel: { type: STRING(100), allowNull: true },
      xendit_webhook_verified: { type: BOOLEAN, allowNull: false, defaultValue: false },
      paid_at: { type: DATE, allowNull: true },
      expired_at: { type: DATE, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('payment_logs', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      payment_id: {
        type: STRING(32),
        allowNull: false,
        references: { model: 'payments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      event_type: { type: STRING(100), allowNull: true },
      event_id: { type: STRING(190), allowNull: true },
      payload: { type: JSON, allowNull: false },
      status: { type: STRING(50), allowNull: false, defaultValue: 'received' },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('usage_logs', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      messages_sent: { type: INTEGER, allowNull: false, defaultValue: 0 },
      date: { type: DATEONLY, allowNull: false },
    });

    await queryInterface.createTable('api_keys', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      api_key: { type: STRING(255), allowNull: false },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('template_messages', {
      id: { type: STRING(32), allowNull: false, primaryKey: true },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: { type: STRING(255), allowNull: false },
      content: { type: TEXT, allowNull: false },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('users', ['email'], { unique: true, name: 'users_email_unique_idx' });
    await queryInterface.addIndex('api_keys', ['api_key'], { unique: true, name: 'api_keys_api_key_unique_idx' });
    await queryInterface.addIndex('payments', ['external_id'], { unique: true, name: 'payments_external_id_unique_idx' });

    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

    const tables = [
      'template_messages',
      'api_keys',
      'usage_logs',
      'payment_logs',
      'payments',
      'subscriptions',
      'plans',
      'jobs',
      'messages',
      'campaigns',
      'contact_list_items',
      'contact_lists',
      'contacts',
      'devices',
      'organization_users',
      'organizations',
      'users',
    ];

    for (const tableName of tables) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.dropTable(tableName).catch(() => {});
    }

    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  },
};
