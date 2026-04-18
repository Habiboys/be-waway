'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('payments', 'plan_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      after: 'organization_id',
    });

    await queryInterface.addIndex('payments', ['plan_id'], {
      name: 'payments_plan_id_idx',
    });

    await queryInterface.addConstraint('payments', {
      fields: ['plan_id'],
      type: 'foreign key',
      name: 'payments_plan_id_fk',
      references: {
        table: 'plans',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Backfill from payment_logs.order_created payload for existing rows (MySQL/MariaDB)
    await queryInterface.sequelize.query(`
      UPDATE payments p
      JOIN (
        SELECT pl.payment_id,
               CAST(JSON_UNQUOTE(JSON_EXTRACT(pl.payload, '$.plan_id')) AS UNSIGNED) AS plan_id
        FROM payment_logs pl
        WHERE pl.event_type = 'order_created'
      ) src ON src.payment_id = p.id
      SET p.plan_id = src.plan_id
      WHERE p.plan_id IS NULL AND src.plan_id IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('payments', 'payments_plan_id_fk');
    await queryInterface.removeIndex('payments', 'payments_plan_id_idx');
    await queryInterface.removeColumn('payments', 'plan_id');
  },
};
