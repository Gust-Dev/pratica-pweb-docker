import redis from "redis";

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || "redis",
    port: process.env.REDIS_PORT || 6379
  }
});

client.on("error", (err) => console.error("Redis error:", err));

async function connectRedis() {
  if (!client.isOpen) {
    await client.connect();
    console.log("Redis conectado com sucesso!");
  }
}

connectRedis();

export default client;
