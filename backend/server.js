import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";

import bd from "./src/models/index.js";
import client from "./redis.js";
import uploadBufferToSupabase from "./src/services/supabaseStorage.js";

dotenv.config();

/* ----------------- MODELOS ----------------- */
const { Task, User } = bd;

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(cors());

/* --------------- SUPABASE CONFIG --------------- */
const SUPABASE_BUCKET = (process.env.SUPABASE_BUCKET ?? "fotos").trim();
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_KEY ??
  "";
const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

if (!process.env.SUPABASE_BUCKET) {
  console.warn(
    "SUPABASE_BUCKET env not set. Using default bucket 'fotos'.",
  );
}

/* ---------------- HELPERS ---------------- */
const ensureUserExists = async () => {
  let user = await User.findOne();

  if (!user) {
    user = await User.create({
      name: "Usuário",
      email: "usuario@example.com",
      avatar_url: null,
    });
  }

  return user;
};

const formatUserResponse = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  photo: user.avatar_url,
});

const sanitizeUrlFallback = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length <= 255 ? trimmed : null;
};

const uploadAvatarFromUrl = async (userId, photoUrl) => {
  if (typeof photoUrl !== "string") {
    return null;
  }

  const trimmed = photoUrl.trim();
  if (!trimmed) {
    return null;
  }

  const isDataUrl = trimmed.startsWith("data:");
  const httpFallback = isDataUrl ? null : sanitizeUrlFallback(trimmed);

  if (!HAS_SUPABASE) {
    if (isDataUrl) {
      console.warn(
        "Supabase credentials missing and image is data URL. Skipping upload to avoid storing large payload.",
      );
      return null;
    }

    console.warn(
      "Supabase storage configuration incomplete. Using provided URL without upload.",
      { bucket: SUPABASE_BUCKET, supabaseUrl: SUPABASE_URL },
    );
    return httpFallback;
  }

  let buffer;
  let contentType;
  let extension;

  if (isDataUrl) {
    const dataMatch = trimmed.match(/^data:(.*?);base64,(.*)$/);
    if (!dataMatch) {
      console.error("Formato de data URL inválido para avatar.");
      return null;
    }

    contentType = dataMatch[1] || "image/jpeg";
    extension = contentType.split("/")[1]?.split(";")[0] || "jpg";

    try {
      buffer = Buffer.from(dataMatch[2], "base64");
    } catch (error) {
      console.error("Falha ao decodificar data URL do avatar:", error);
      return null;
    }
  } else {
    let response;
    try {
      response = await fetch(trimmed);
    } catch (error) {
      console.error("Falha ao baixar avatar remoto (rede):", error);
      return httpFallback;
    }

    if (!response.ok) {
      console.error(
        `Falha ao baixar avatar remoto. Status: ${response.status} ${response.statusText}`,
      );
      return httpFallback;
    }

    contentType = response.headers.get("content-type") || "image/jpeg";
    extension = contentType.split("/")[1]?.split(";")[0] || "jpg";
    buffer = Buffer.from(await response.arrayBuffer());
  }

  try {
    const objectPath = `imagens/${userId}/avatar.${extension}`;
    const { publicUrl } = await uploadBufferToSupabase({
      buffer,
      contentType,
      objectPath,
      upsert: true,
    });

    console.info("Avatar uploaded to Supabase", {
      bucket: SUPABASE_BUCKET,
      storagePath: objectPath,
      publicUrl,
    });

    return publicUrl;
  } catch (error) {
    console.error("Falha ao subir avatar para Supabase:", error);
    const statusCode = Number(
      error?.status ?? error?.statusCode ?? error?.cause?.statusCode ?? error?.cause?.status ?? 0,
    );

    if (statusCode === 403) {
      console.error(
        "A requisição foi bloqueada por políticas do bucket no Supabase. Verifique as Storage Policies ou utilize a service role key para uploads no backend.",
      );
    }

    return httpFallback;
  }
};

/* ---------------- MULTER (memória) ---------------- */
const upload = multer({ storage: multer.memoryStorage() });

/* ---------------- ROTAS ---------------- */

/* TESTE */
app.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});

app.get("/profile", async (req, res) => {
  try {
    const user = await ensureUserExists();
    res.json(formatUserResponse(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar perfil" });
  }
});

app.put("/profile", async (req, res) => {
  try {
    const { id, name, email, photo } = req.body;

    const user =
      (id && (await User.findByPk(id))) || (await ensureUserExists());

    const updates = {};

    if (typeof name === "string") {
      updates.name = name;
    }

    if (typeof email === "string") {
      updates.email = email;
    }

    if (typeof photo === "string") {
      if (photo.trim() === "") {
        updates.avatar_url = null;
      } else if (photo !== user.avatar_url) {
        const processedAvatarUrl = await uploadAvatarFromUrl(
          user.id,
          photo,
        ).catch((error) => {
          console.error("Falha ao processar avatar remoto:", error);
          return sanitizeUrlFallback(photo);
        });

        if (typeof processedAvatarUrl === "string") {
          updates.avatar_url = processedAvatarUrl;
        }
      }
    }

    await user.update(updates);
    await user.reload();

    res.json(formatUserResponse(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
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

    if (!description) {
      return res.status(400).json({ error: "Descrição obrigatória" });
    }

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

    if (!task) {
      return res.status(404).json({ error: "Tarefa não encontrada" });
    }

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

    if (!task) {
      return res.status(404).json({ error: "Tarefa não encontrada" });
    }

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

    if (!deleted) {
      return res.status(404).json({ error: "Tarefa não encontrada" });
    }

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

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Imagem obrigatória" });
    }

    const file = req.file;
    const ext = file.originalname.split(".").pop()?.toLowerCase() || "bin";

    if (!HAS_SUPABASE) {
      return res.status(500).json({
        error:
          "Configuração do Supabase ausente. Defina SUPABASE_URL, SUPABASE_BUCKET e chave de acesso.",
      });
    }

    const objectPath = `imagens/${user.id}/avatar.${ext}`;

    const { publicUrl } = await uploadBufferToSupabase({
      buffer: file.buffer,
      contentType: file.mimetype,
      objectPath,
      upsert: true,
    });

    await user.update({ avatar_url: publicUrl });
    await user.reload();

    res.json({
      message: "Avatar atualizado!",
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Erro ao enviar avatar",
    });
  }
});

/* -------- START -------- */
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
