'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID, STRING, DATE, INTEGER, BOOLEAN, ENUM, JSON } = Sequelize;

    await queryInterface.createTable('otp_apps', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: { type: STRING(80), allowNull: false },
      environment: { type: ENUM('sandbox', 'production'), allowNull: false, defaultValue: 'sandbox' },
      default_channel: { type: ENUM('whatsapp', 'sms', 'email'), allowNull: false, defaultValue: 'whatsapp' },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('otp_app_api_keys', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      otp_app_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'otp_apps', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      api_key: { type: STRING(255), allowNull: false },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      last_used_at: { type: DATE, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      revoked_at: { type: DATE, allowNull: true },
    });

    await queryInterface.createTable('otp_app_policies', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      otp_app_id: {
        type: UUID,
        allowNull: false,
        unique: true,
        references: { model: 'otp_apps', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ttl_seconds: { type: INTEGER, allowNull: false, defaultValue: 300 },
      code_length: { type: INTEGER, allowNull: false, defaultValue: 6 },
      max_attempts: { type: INTEGER, allowNull: false, defaultValue: 5 },
      resend_cooldown_seconds: { type: INTEGER, allowNull: false, defaultValue: 60 },
      max_resend: { type: INTEGER, allowNull: false, defaultValue: 3 },
      rate_limit_per_minute: { type: INTEGER, allowNull: false, defaultValue: 30 },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.createTable('otp_transactions', {
      id: { type: UUID, allowNull: false, primaryKey: true },
      organization_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      otp_app_id: {
        type: UUID,
        allowNull: false,
        references: { model: 'otp_apps', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      api_key_id: {
        type: UUID,
        allowNull: true,
        references: { model: 'otp_app_api_keys', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      channel: { type: ENUM('whatsapp', 'sms', 'email'), allowNull: false },
      purpose: { type: STRING(30), allowNull: false },
      destination: { type: STRING(190), allowNull: false },
      destination_hash: { type: STRING(128), allowNull: false },
      destination_masked: { type: STRING(190), allowNull: false },
      reference_id: { type: STRING(100), allowNull: true },
      code_hash: { type: STRING(128), allowNull: false },
      status: {
        type: ENUM('created', 'sent', 'verified', 'expired', 'blocked', 'cancelled', 'failed'),
        allowNull: false,
        defaultValue: 'created',
      },
      attempt_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      resend_count: { type: INTEGER, allowNull: false, defaultValue: 0 },
      max_attempts: { type: INTEGER, allowNull: false, defaultValue: 5 },
      max_resend: { type: INTEGER, allowNull: false, defaultValue: 3 },
      expires_at: { type: DATE, allowNull: false },
      next_resend_at: { type: DATE, allowNull: false },
      verified_at: { type: DATE, allowNull: true },
      used_at: { type: DATE, allowNull: true },
      cancelled_at: { type: DATE, allowNull: true },
      blocked_until: { type: DATE, allowNull: true },
      idempotency_key: { type: STRING(120), allowNull: true },
      metadata: { type: JSON, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('otp_apps', ['organization_id'], { name: 'otp_apps_org_idx' });
    await queryInterface.addIndex('otp_apps', ['organization_id', 'name', 'environment'], {
      unique: true,
      name: 'otp_apps_org_name_env_unique_idx',
    });

    await queryInterface.addIndex('otp_app_api_keys', ['otp_app_id'], { name: 'otp_app_api_keys_app_idx' });
    await queryInterface.addIndex('otp_app_api_keys', ['organization_id'], { name: 'otp_app_api_keys_org_idx' });
    await queryInterface.addIndex('otp_app_api_keys', ['api_key'], {
      unique: true,
      name: 'otp_app_api_keys_api_key_unique_idx',
    });

    await queryInterface.addIndex('otp_app_policies', ['organization_id'], { name: 'otp_app_policies_org_idx' });

    await queryInterface.addIndex('otp_transactions', ['organization_id', 'otp_app_id', 'created_at'], {
      name: 'otp_transactions_org_app_created_idx',
    });
    await queryInterface.addIndex('otp_transactions', ['otp_app_id', 'reference_id'], {
      name: 'otp_transactions_app_reference_idx',
    });
    await queryInterface.addIndex('otp_transactions', ['otp_app_id', 'idempotency_key'], {
      unique: true,
      name: 'otp_transactions_app_idempotency_unique_idx',
    });
    await queryInterface.addIndex('otp_transactions', ['destination_hash'], {
      name: 'otp_transactions_destination_hash_idx',
    });
    await queryInterface.addIndex('otp_transactions', ['status', 'expires_at'], {
      name: 'otp_transactions_status_expires_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('otp_transactions');
    await queryInterface.dropTable('otp_app_policies');
    await queryInterface.dropTable('otp_app_api_keys');
    await queryInterface.dropTable('otp_apps');
  },
};
