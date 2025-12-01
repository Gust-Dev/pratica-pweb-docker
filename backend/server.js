import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bd from "./src/models/index.js";

dotenv.config();

const { Task } = bd;
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// --- ROTAS ---
app.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});

app.get("/tasks", async (req, res) => {
  const tasks = await Task.findAll();
  res.json(tasks);
});

app.post("/tasks", async (req, res) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: "Descrição obrigatória" });
  const task = await Task.create({ description, completed: false });
  res.status(201).json(task);
});

app.get("/tasks/:id", async (req, res) => {
  const task = await Task.findByPk(req.params.id);
  if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });
  res.json(task);
});

app.put("/tasks/:id", async (req, res) => {
  const { description, completed } = req.body;
  const task = await Task.findByPk(req.params.id);
  if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });
  await task.update({ description, completed });
  res.json(task);
});

app.delete("/tasks/:id", async (req, res) => {
  const deleted = await Task.destroy({ where: { id: req.params.id } });
  if (!deleted) return res.status(404).json({ error: "Tarefa não encontrada" });
  res.status(204).send();
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
const startServer = async () => {
  try {
    // 1. Tenta conectar
    await bd.sequelize.authenticate();
    console.log("Conexão com o banco de dados estabelecida com sucesso.");

    // 2. CRIA AS TABELAS SE NÃO EXISTIREM (O PULO DO GATO 😺)
    await bd.sequelize.sync(); 
    console.log("Tabelas sincronizadas (criadas se não existiam).");

    // 3. Só agora sobe o servidor
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on port ${port}`);
    });

  } catch (error) {
    console.error("Erro fatal ao iniciar a aplicação:", error);
    process.exit(1);
  }
};

startServer();