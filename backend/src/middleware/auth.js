
import jwt from "jsonwebtoken";

export function auth(req, res, next) {
  try {
    const header = req.headers.authorization;

    // Verifica se o header Authorization existe
    if (!header) {
      return res.status(401).json({ error: "Token não enviado" });
    }

    // Remove o prefixo "Bearer " e extrai o token
    const token = header.replace("Bearer ", "").trim();

    // Valida e decodifica o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Torna os dados do usuário disponíveis para a rota
    req.user = decoded;

    next(); // libera para a rota protegida
  } catch (error) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}
