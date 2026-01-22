import Fastify from "fastify";
import { renderController } from "./controllers/render.js";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fs from "fs/promises";
import browserPool from "./core/browser-pool.js";

const fastify = Fastify({
  logger: true,
  pluginTimeout: 60000,
  bodyLimit: 50 * 1024 * 1024, // 50MB
});

// Load swagger.json
const swaggerJson = JSON.parse(
  await fs.readFile("./app/docs/swagger.json", "utf8")
);

// Register Swagger
await fastify.register(swagger, {
  mode: "static",
  specification: {
    document: swaggerJson,
  },
});

// Register Swagger UI
await fastify.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "full",
    deepLinking: false,
  },
  uiHooks: {
    onRequest: function (request, reply, next) {
      next();
    },
    preHandler: function (request, reply, next) {
      next();
    },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject, request, reply) => {
    return swaggerObject;
  },
  transformSpecificationClone: true,
});

// Declare a route
fastify.get("/", function (request, reply) {
  reply.send({ info: "Html2Pdf API" });
});

fastify.get("/ping", function (request, reply) {
  reply.send("pong");
});

// Health check endpoint with browser pool stats
fastify.get("/health", function (request, reply) {
  const poolStats = browserPool.getStats();
  const isHealthy = poolStats && poolStats.available > 0;
  
  const health = {
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    browserPool: poolStats || "Not initialized",
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
    },
  };
  
  reply.code(isHealthy ? 200 : 503).send(health);
});

// Register render controller
fastify.post("/render", renderController);
fastify.get("/render", renderController);

const start = async () => {
  try {
    // Initialize browser pool before starting server
    browserPool.initialize({
      min: 2,
      max: 10,
      acquireTimeout: 30000,
      createTimeout: 30000,
      idleTimeout: 60000,
    });
    
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    console.log(`Server started on port 3000`);
    console.log(
      `Swagger documentation available at http://localhost:3000/docs`
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();

process.on("SIGINT", async () => {
  console.log("Server is shutting down");
  await browserPool.drain();
  await fastify.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Server is shutting down");
  await browserPool.drain();
  await fastify.close();
  process.exit(0);
});
