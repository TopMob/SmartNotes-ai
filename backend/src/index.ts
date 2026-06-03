import fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { chatRoutes } from "./routes/chat.js";
import { analyzeRoutes } from "./routes/analyze.js";

dotenv.config();
dotenv.config({ path: "../.env" });

const PORT = parseInt(process.env.PORT || "8081", 10);
const HOST = process.env.HOST || "0.0.0.0";

const server = fastify({
  logger: {
    level: "info",
  },
});

server.register(cors, {
  origin: "*",
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

server.register(chatRoutes);
server.register(analyzeRoutes);

const start = async () => {
  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`AI Backend server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
