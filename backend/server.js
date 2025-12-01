import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bd from "./src/models/index.js";
import client from "./src/redis.js"; // importa redis

dotenv.config();

const { Task } = bd;
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// --- ROTAS ---

// Rota inicial
app.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});

// LISTAR TASKS (com cache Redis)
app.get("/tasks", async (req, res) => {
  try {
    // 1. Verifica cache existente
    const cache = await client.get("tasks");

    if (cache) {
      console.log("✔ Dados carregados do REDIS");
      return res.json(JSON.parse(cache));
    }

    console.log("✖ Cache vazio — consultando BD...");
    const tasks = await Task.findAll();

    // 2. Guarda no Redis por 30 segundos
    await client.setEx("tasks", 30, JSON.stringify(tasks));

    res.json(tasks);

  } catch (error) {
    console.error("Erro GET /tasks:", error);
    res.status(500).json({ error: "Erro ao buscar tarefas" });
  }
});

// CRIAR TASK
app.post("/tasks", async (req, res) => {
  try {
    const { description } = req.body;

    if (!description)
      return res.status(400).json({ error: "Descrição obrigatória" });

    const task = await Task.create({ description, completed: false });

    await client.del("tasks"); // limpa cache ao criar
    res.status(201).json(task);

  } catch (error) {
    console.error("Erro POST /tasks:", error);
    res.status(500).json({ error: "Erro ao criar tarefa" });
  }
});

// BUSCAR UMA TASK POR ID
app.get("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);

    if (!task)
      return res.status(404).json({ error: "Tarefa não encontrada" });

    res.json(task);

  } catch (error) {
    console.error("Erro GET /tasks/:id:", error);
    res.status(500).json({ error: "Erro ao buscar tarefa" });
  }
});

// ATUALIZAR TASK
app.put("/tasks/:id", async (req, res) => {
  try {
    const { description, completed } = req.body;

    const task = await Task.findByPk(req.params.id);

    if (!task)
      return res.status(404).json({ error: "Tarefa não encontrada" });

    await task.update({ description, completed });

    await client.del("tasks"); // limpa cache ao atualizar

    res.json(task);

  } catch (error) {
    console.error("Erro PUT /tasks/:id:", error);
    res.status(500).json({ error: "Erro ao atualizar tarefa" });
  }
});

// DELETAR TASK
app.delete("/tasks/:id", async (req, res) => {
  try {
    const deleted = await Task.destroy({ where: { id: req.params.id } });

    if (!deleted)
      return res.status(404).json({ error: "Tarefa não encontrada" });

    await client.del("tasks"); // limpa cache ao deletar

    res.status(204).send();

  } catch (error) {
    console.error("Erro DELETE /tasks/:id:", error);
    res.status(500).json({ error: "Erro ao deletar tarefa" });
  }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
const startServer = async () => {
  try {
    await bd.sequelize.authenticate();
    console.log("Conexão com o banco de dados estabelecida com sucesso.");

    await bd.sequelize.sync();
    console.log("Tabelas sincronizadas.");

    app.listen(port, "0.0.0.0", () => {
      console.log(`Server is running on port ${port}`);
    });

  } catch (error) {
    console.error("Erro fatal ao iniciar a aplicação:", error);
    process.exit(1);
  }
};

startServer();