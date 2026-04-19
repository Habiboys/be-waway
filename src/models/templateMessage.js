const crypto = require('crypto');

const createTemplateId = () => `tpl_${crypto.randomBytes(6).toString('hex')}`;

module.exports = (sequelize, DataTypes) => {
  const TemplateMessage = sequelize.define(
    'TemplateMessage',
    {
      id: {
        type: DataTypes.STRING(32),
        defaultValue: createTemplateId,
        primaryKey: true,
      },
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'template_messages',
      underscored: true,
      timestamps: false,
    }
  );

  TemplateMessage.associate = function (models) {
    TemplateMessage.belongsTo(models.Organization, {
      foreignKey: 'organization_id',
      as: 'organization',
    });
  };

  return TemplateMessage;
};
