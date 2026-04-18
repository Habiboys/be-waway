const buildCrudController = require('./crudFactory');

module.exports = buildCrudController({ modelName: 'Plan', label: 'Plan', scoped: false });
