'use strict';

module.exports = (sequelize, DataTypes) => {
  const Job = sequelize.define('Job', {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    type: { type: DataTypes.STRING(100), allowNull: false },
    payload: { type: DataTypes.JSON, allowNull: true },
    status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'pending' },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    run_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'jobs',
    timestamps: false
  });

  return Job;
};
