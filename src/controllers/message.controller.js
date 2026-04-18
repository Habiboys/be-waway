const buildCrudController = require('./crudFactory');

module.exports = buildCrudController({ modelName: 'Message', label: 'Message', scoped: false });
