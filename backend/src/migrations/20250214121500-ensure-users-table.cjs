'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    let tableDefinition;

    try {
      tableDefinition = await queryInterface.describeTable('Users');
    } catch (error) {
      tableDefinition = null;
    }

    if (!tableDefinition) {
      await queryInterface.createTable('Users', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        email: {
          type: Sequelize.STRING,
          allowNull: true,
          unique: true,
        },
        avatar_url: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now'),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now'),
        },
      });

      return;
    }

    if (!tableDefinition.email) {
      await queryInterface.addColumn('Users', 'email', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      });
    }

    if (!tableDefinition.avatar_url) {
      await queryInterface.addColumn('Users', 'avatar_url', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    let tableDefinition;

    try {
      tableDefinition = await queryInterface.describeTable('Users');
    } catch (error) {
      tableDefinition = null;
    }

    if (!tableDefinition) {
      return;
    }

    if (tableDefinition.avatar_url) {
      await queryInterface.removeColumn('Users', 'avatar_url');
    }

    if (tableDefinition.email) {
      await queryInterface.removeColumn('Users', 'email');
    }
  },
};
