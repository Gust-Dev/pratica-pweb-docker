/* -------------------------------------------------------
   MODEL: User
   -------------------------------------------------------
   Estrutura da tabela de usuários utilizada pelo Sequelize.

   CAMPOS:
   - id: UUID gerado automaticamente.
   - name: Nome do usuário.
   - email: ÚNICO, usado para login.
   - password: hash seguro gerado pelo bcrypt.
   - avatar_url: URL pública da imagem no Supabase.
   ------------------------------------------------------- */

export default (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    // Nome do usuário
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },

    // Email único (necessário para login JWT)
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },

    // Senha criptografada usando bcrypt
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },

    // Foto do usuário (armazenada no Supabase)
    avatar_url: {
      type: DataTypes.STRING,
      allowNull: true
    }
  });

  return User;
};
