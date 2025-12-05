"use strict";

module.exports = {

  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Users", {
      // ID único no formato UUID
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"), // Gera UUID automaticamente
        primaryKey: true,
        allowNull: false
      },

      // Nome do usuário
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },

      // Email único, utilizado para login JWT
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true // Impede emails duplicados
      },

      // Senha criptografada com bcrypt
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },

      // URL da imagem do usuário no Supabase Storage
      avatar_url: {
        type: Sequelize.STRING,
        allowNull: true
      },

      // Data de criação (preenchida automaticamente)
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW")
      },

      // Data de atualização (preenchida automaticamente)
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW")
      }
    });
  },

  /* -------------------------------------------------------
     Função DOWN:
     Executada quando rodamos:
     npx sequelize-cli db:migrate:undo
     -------------------------------------------------------

  --------------------------------------------------------- */
  async down(queryInterface) {
    await queryInterface.dropTable("Users");
  }
};
