import Fastify from "fastify";
import { renderController } from "./controllers/render.js";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fs from "fs/promises";

const fastify = Fastify({
  logger: true,
  pluginTimeout: 60000,
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

// Register render controller
fastify.post("/render", renderController);
fastify.get("/render", renderController);

const start = async () => {
  try {
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

process.on("SIGINT", () => {
  console.log("Server is shutting down");
  process.exit(0);
});
