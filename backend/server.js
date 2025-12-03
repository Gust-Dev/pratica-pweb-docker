import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

import bd from "./src/models/index.js";
import client from "./redis.js";

dotenv.config();

/* ----------------- MODELOS ----------------- */
const { Task, User } = bd;

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

/* --------------- SUPABASE CONFIG --------------- */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const BUCKET = process.env.SUPABASE_BUCKET;

/* ---------------- MULTER (memória) ---------------- */
const upload = multer({ storage: multer.memoryStorage() });

/* ---------------- ROTAS ---------------- */

/* TESTE */
app.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});

/* -------- LISTAR TASKS (COM CACHE) -------- */
app.get("/tasks", async (req, res) => {
  try {
    const cache = await client.get("tasks");

    if (cache) {
      console.log("✔ HIT: Dados do Redis");
      return res.json(JSON.parse(cache));
    }

    console.log("✖ MISS: Buscando no banco...");
    const tasks = await Task.findAll();

    await client.setEx("tasks", 30, JSON.stringify(tasks));

    res.json(tasks);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar tarefas" });
  }
});

/* -------- CRIAR TASK -------- */
app.post("/tasks", async (req, res) => {
  try {
    const { description } = req.body;

    if (!description)
      return res.status(400).json({ error: "Descrição obrigatória" });

    const task = await Task.create({ description, completed: false });

    await client.del("tasks");

    res.status(201).json(task);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar tarefa" });
  }
});

/* -------- BUSCAR POR ID -------- */
app.get("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);

    if (!task)
      return res.status(404).json({ error: "Tarefa não encontrada" });

    res.json(task);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar tarefa" });
  }
});

/* -------- ATUALIZAR TASK -------- */
app.put("/tasks/:id", async (req, res) => {
  try {
    const { description, completed } = req.body;

    const task = await Task.findByPk(req.params.id);

    if (!task)
      return res.status(404).json({ error: "Tarefa não encontrada" });

    await task.update({ description, completed });

    await client.del("tasks");

    res.json(task);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar tarefa" });
  }
});

/* -------- DELETAR TASK -------- */
app.delete("/tasks/:id", async (req, res) => {
  try {
    const deleted = await Task.destroy({ where: { id: req.params.id } });

    if (!deleted)
      return res.status(404).json({ error: "Tarefa não encontrada" });

    await client.del("tasks");

    res.status(204).send();

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao deletar tarefa" });
  }
});

/* -------- UPLOAD DE AVATAR (SUPABASE STORAGE) -------- */
app.put("/users/:id/avatar", upload.single("avatar"), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user)
      return res.status(404).json({ error: "Usuário não encontrado" });

    if (!req.file)
      return res.status(400).json({ error: "Imagem obrigatória" });

    // Nome do arquivo
    const file = req.file;
    const ext = file.originalname.split(".").pop();
    const storagePath = `avatars/user-${user.id}.${ext}`;

    // Upload para Supabase
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError)
      return res.status(500).json({ error: uploadError.message });

    // URL pública
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    // Atualizar usuário
    await user.update({ avatar_url: data.publicUrl });

    res.json({
      message: "Avatar atualizado!",
      avatar_url: data.publicUrl
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao enviar avatar" });
  }
});

/* -------- START -------- */
const startServer = async () => {
  try {
    await bd.sequelize.authenticate();
    console.log("Banco conectado");

    await bd.sequelize.sync();
    console.log("Tabelas sincronizadas");

    app.listen(port, "0.0.0.0", () => {
      console.log(`Server ON na porta ${port}`);
    });
  } catch (error) {
    console.error("Erro ao iniciar:", error);
    process.exit(1);
  }
};

startServer();
