/* -------------------------------------------------------
   SERVER: Backend principal do projeto
---------------------------------------------------------
   Serviços implementados:
   - Express API
   - Supabase Storage
   - Redis Cache
   - Sequelize ORM
   - Bcrypt (hash de senha)
   - JWT (autenticação)
   - Upload de imagens (multer)
   - Middleware de proteção de rotas
--------------------------------------------------------- */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";

import bcrypt from "bcrypt";       // Senhas seguras com hash
import jwt from "jsonwebtoken";    // Tokens JWT

import bd from "./src/models/index.js";
import client from "./redis.js";
import uploadBufferToSupabase from "./src/services/supabaseStorage.js";
import { auth } from "./src/middleware/auth.js"; // Middleware de proteção

dotenv.config();

/* ----------------- MODELOS ----------------- */
const { Task, User } = bd;

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(cors());

/* ----------------- FUNÇÕES AUTH ----------------- */

/* Gera hash seguro da senha */
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

/* Compara senha enviada com hash salvo */
async function comparePassword(password, hashed) {
  return bcrypt.compare(password, hashed);
}

/* Gera token contendo dados do usuário */
function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" });
}

/* Decodifica token JWT diretamente */
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

/* ----------------- SUPABASE CONFIG ----------------- */

const SUPABASE_BUCKET = (process.env.SUPABASE_BUCKET ?? "fotos").trim();
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_KEY ??
  "";
const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

/* ---------------- HELPERS ---------------- */

/* Garante existência de 1 usuário inicial (apenas para testes) */
const ensureUserExists = async () => {
  let user = await User.findOne();

  if (!user) {
    const hashed = await hashPassword("123456"); // Senha padrão DEV

    user = await User.create({
      name: "Usuário",
      email: "usuario@example.com",
      password: hashed,
      avatar_url: null,
    });
  }

  return user;
};

/* Formata o retorno seguro do usuário */
const formatUserResponse = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  photo: user.avatar_url,
});

/* ---------------- AUTENTICAÇÃO ---------------- */

/* -------- REGISTRO -------- */
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: "Campos obrigatórios: name, email, password" });

    const existing = await User.findOne({ where: { email } });
    if (existing)
      return res.status(400).json({ error: "Email já cadastrado" });

    const hashed = await hashPassword(password);

    const user = await User.create({
      name,
      email,
      password: hashed,
    });

    res.status(201).json({ message: "Usuário cadastrado com sucesso", id: user.id });
  } catch (error) {
    console.error("Erro no registro:", error);
    res.status(500).json({ error: "Erro ao registrar usuário" });
  }
});

/* -------- LOGIN -------- */
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const valid = await comparePassword(password, user.password);
    if (!valid) return res.status(401).json({ error: "Senha incorreta" });

    const token = generateToken({ id: user.id, email: user.email });

    res.json({ token });
  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({ error: "Erro no login" });
  }
});

/* -------- SIGNIN (LOGIN) --------
   Funciona como /auth/login
------------------------------------------------------- */
app.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Verifica se email e senha foram enviados
    if (!email || !password)
      return res.status(400).json({ error: "Email e senha são obrigatórios" });

    // Busca o usuário no banco
    const user = await User.findOne({ where: { email } });
    if (!user)
      return res.status(404).json({ error: "Usuário não encontrado" });

    // Compara senha enviada
    const valid = await comparePassword(password, user.password);
    if (!valid)
      return res.status(401).json({ error: "Senha incorreta" });

    // Gera o token JWT
    const token = generateToken({ id: user.id, email: user.email });

    res.json({ token });
  } catch (error) {
    console.error("Erro no signin:", error);
    res.status(500).json({ error: "Erro ao autenticar usuário" });
  }
});

/* ---------------- ROTAS DE PERFIL (PROTEGIDAS) ---------------- */

/* Rota protegida por JWT */
app.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json(formatUserResponse(user));
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar perfil" });
  }
});

/* Atualização do perfil (sempre protegida) */
app.put("/profile", auth, async (req, res) => {
  try {
    const { name, email } = req.body;

    const user = await User.findByPk(req.user.id);

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const updates = {};

    if (typeof name === "string") updates.name = name;
    if (typeof email === "string") updates.email = email;

    await user.update(updates);
    await user.reload();

    res.json(formatUserResponse(user));
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
});

/* ---------------- ROTAS TASKS ---------------- */

app.get("/tasks", async (req, res) => {
  try {
    const cache = await client.get("tasks");

    if (cache) return res.json(JSON.parse(cache));

    const tasks = await Task.findAll();
    await client.setEx("tasks", 30, JSON.stringify(tasks));

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar tarefas" });
  }
});

app.post("/tasks", async (req, res) => {
  try {
    const { description } = req.body;

    if (!description)
      return res.status(400).json({ error: "Descrição obrigatória" });

    const task = await Task.create({ description, completed: false });

    await client.del("tasks");

    res.status(201).json(task);
  } catch {
    res.status(500).json({ error: "Erro ao criar tarefa" });
  }
});

/* ---------------- AVATAR UPLOAD ---------------- */

const upload = multer({ storage: multer.memoryStorage() });

app.put("/users/:id/avatar", auth, upload.single("avatar"), async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (!req.file) return res.status(400).json({ error: "Imagem obrigatória" });

    const file = req.file;
    const ext = file.originalname.split(".").pop();

    const objectPath = `imagens/${user.id}/avatar.${ext}`;

    const { publicUrl } = await uploadBufferToSupabase({
      buffer: file.buffer,
      contentType: file.mimetype,
      objectPath,
      upsert: true,
    });

    await user.update({ avatar_url: publicUrl });

    res.json({
      message: "Avatar atualizado!",
      user: formatUserResponse(user),
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar avatar" });
  }
});

/* ---------------- START SERVER ---------------- */

const startServer = async () => {
  try {
    await bd.sequelize.authenticate();
    console.log("Banco conectado");

    await bd.sequelize.sync();
    console.log("Tabelas sincronizadas");

    await ensureUserExists();

    app.listen(port, "0.0.0.0", () => {
      console.log(`Server ON na porta ${port}`);
    });
  } catch (error) {
    console.error("Erro ao iniciar:", error);
    process.exit(1);
  }
};

startServer();
