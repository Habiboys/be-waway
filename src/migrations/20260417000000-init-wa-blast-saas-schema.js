'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(190),
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      role: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'member'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.createTable('organizations', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(190),
        allowNull: false
      },
      owner_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.createTable('organization_users', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      organization_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      role: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'member'
      }
    });

    await queryInterface.addConstraint('organization_users', {
      fields: ['organization_id', 'user_id'],
      type: 'unique',
      name: 'organization_users_unique_member'
    });

    await queryInterface.createTable('devices', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      organization_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      device_name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      phone_number: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'offline'
      },
      session_data: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      last_seen: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.createTable('contacts', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      organization_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(190),
        allowNull: false
      },
      phone_number: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      custom_fields: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.createTable('contact_lists', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      organization_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(190),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.createTable('contact_list_items', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      list_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'contact_lists',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      contact_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'contacts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }
    });

    await queryInterface.addConstraint('contact_list_items', {
      fields: ['list_id', 'contact_id'],
      type: 'unique',
      name: 'contact_list_items_unique_contact'
    });

    await queryInterface.createTable('campaigns', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      organization_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      device_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'devices',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      name: {
        type: Sequelize.STRING(190),
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      media_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'draft'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      campaign_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'campaigns',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      contact_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'contacts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      phone_number: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'queued'
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    await queryInterface.createTable('jobs', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      type: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      payload: {
        type: Sequelize.JSON,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'pending'
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      run_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.createTable('plans', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      price: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      message_limit: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      device_limit: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      duration_days: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.createTable('subscriptions', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      organization_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      plan_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'plans',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'active'
      }
    });

    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      organization_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      subscription_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'subscriptions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'IDR'
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'pending'
      },
      payment_gateway: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'xendit'
      },
      transaction_id: {
        type: Sequelize.STRING(190),
        allowNull: true
      },
      external_id: {
        type: Sequelize.STRING(190),
        allowNull: false,
        unique: true
      },
      xendit_invoice_id: {
        type: Sequelize.STRING(190),
        allowNull: true,
        unique: true
      },
      xendit_payment_id: {
        type: Sequelize.STRING(190),
        allowNull: true
      },
      xendit_payment_method: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      xendit_payment_channel: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      xendit_webhook_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      paid_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      expired_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.createTable('payment_logs', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      payment_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'payments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      event_type: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      event_id: {
        type: Sequelize.STRING(190),
        allowNull: true
      },
      payload: {
        type: Sequelize.JSON,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'received'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.createTable('usage_logs', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      organization_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      messages_sent: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      }
    });

    await queryInterface.addConstraint('usage_logs', {
      fields: ['organization_id', 'date'],
      type: 'unique',
      name: 'usage_logs_unique_per_day'
    });

    await queryInterface.createTable('api_keys', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      organization_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      api_key: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('organizations', ['owner_id']);
    await queryInterface.addIndex('organization_users', ['organization_id']);
    await queryInterface.addIndex('organization_users', ['user_id']);
    await queryInterface.addIndex('devices', ['organization_id']);
    await queryInterface.addIndex('contacts', ['organization_id']);
    await queryInterface.addIndex('contact_lists', ['organization_id']);
    await queryInterface.addIndex('contact_list_items', ['list_id']);
    await queryInterface.addIndex('contact_list_items', ['contact_id']);
    await queryInterface.addIndex('campaigns', ['organization_id']);
    await queryInterface.addIndex('campaigns', ['device_id']);
    await queryInterface.addIndex('messages', ['campaign_id']);
    await queryInterface.addIndex('messages', ['contact_id']);
    await queryInterface.addIndex('subscriptions', ['organization_id']);
    await queryInterface.addIndex('subscriptions', ['plan_id']);
    await queryInterface.addIndex('payments', ['organization_id']);
    await queryInterface.addIndex('payments', ['subscription_id']);
    await queryInterface.addIndex('payments', ['status']);
    await queryInterface.addIndex('payment_logs', ['payment_id']);
    await queryInterface.addIndex('usage_logs', ['organization_id']);
    await queryInterface.addIndex('api_keys', ['organization_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('api_keys');
    await queryInterface.dropTable('usage_logs');
    await queryInterface.dropTable('payment_logs');
    await queryInterface.dropTable('payments');
    await queryInterface.dropTable('subscriptions');
    await queryInterface.dropTable('plans');
    await queryInterface.dropTable('jobs');
    await queryInterface.dropTable('messages');
    await queryInterface.dropTable('campaigns');
    await queryInterface.dropTable('contact_list_items');
    await queryInterface.dropTable('contact_lists');
    await queryInterface.dropTable('contacts');
    await queryInterface.dropTable('devices');
    await queryInterface.dropTable('organization_users');
    await queryInterface.dropTable('organizations');
    await queryInterface.dropTable('users');
  }
};
