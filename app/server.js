import Fastify from "fastify";
import { renderController } from "./controllers/render.js";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fs from "fs/promises";
import browserPool from "./core/browser-pool.js";
import {
  SERVER_PORT, PLUGIN_TIMEOUT_MS, BODY_LIMIT_BYTES, SHUTDOWN_TIMEOUT_MS,
  POOL_MIN, POOL_MAX, POOL_ACQUIRE_TIMEOUT_MS, POOL_CREATE_TIMEOUT_MS, POOL_IDLE_TIMEOUT_MS,
} from "./config/constants.js";

const fastify = Fastify({
  logger: true,
  pluginTimeout: PLUGIN_TIMEOUT_MS,
  bodyLimit: BODY_LIMIT_BYTES,
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

// Drain browser pool on Fastify close (after in-flight requests finish)
fastify.addHook("onClose", async () => {
  await browserPool.drain();
});

const start = async () => {
  try {
    // Initialize browser pool and await warmup before starting server
    browserPool.initialize({
      min: POOL_MIN,
      max: POOL_MAX,
      acquireTimeout: POOL_ACQUIRE_TIMEOUT_MS,
      createTimeout: POOL_CREATE_TIMEOUT_MS,
      idleTimeout: POOL_IDLE_TIMEOUT_MS,
      warmUp: false,
    });
    await browserPool.warmUp();

    await fastify.listen({ port: SERVER_PORT, host: "0.0.0.0" });
    console.log(`Server started on port ${SERVER_PORT}`);
    console.log(
      `Swagger documentation available at http://localhost:${SERVER_PORT}/docs`
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  const timeout = setTimeout(() => {
    console.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timeout.unref();

  try {
    await fastify.close(); // onClose hook drains browser pool after in-flight requests
  } catch (err) {
    console.error("Error during shutdown:", err);
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
