import { PuppeteerWrapper } from "../core/wrapper.js";
import browserPool from "../core/browser-pool.js";

/**
 * Render controller for handling rendering requests
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function renderController(request, reply) {
  let wrapper = null;
  
  try {
    let config;
    if (request.method === "GET") {
      try {
        config = JSON.parse(request.query.config);
      } catch (e) {
        return reply.code(400).send({ error: "Invalid JSON in config query parameter" });
      }
    } else {
      config = request.body;
    }

    wrapper = new PuppeteerWrapper(config);

    try {
      await wrapper.initialize();
      const { content, contentType, filename } = await wrapper.captureOutput();

      reply.header("Content-Type", contentType);
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);
      
      // Add pool stats header for monitoring
      const poolStats = browserPool.getStats();
      if (poolStats) {
        reply.header("X-Browser-Pool-Stats", JSON.stringify({
          available: poolStats.available,
          borrowed: poolStats.borrowed,
          pending: poolStats.pending,
        }));
      }
      
      return reply.send(content);
    } catch (error) {
      request.log.error({ err: error, url: config?.url, type: config?.type }, "Rendering error");

      if (error.message && error.message.includes("pool")) {
        return reply
          .code(503)
          .send({ error: "Service temporarily unavailable" });
      }

      return reply
        .code(500)
        .send({ error: "An error occurred during rendering" });
    } finally {
      // Always try to clean up resources
      if (wrapper) {
        try {
          await wrapper.close();
        } catch (cleanupError) {
          request.log.error({ err: cleanupError }, "Error during cleanup");
        }
      }
    }
  } catch (error) {
    // Handle validation errors
    let errorMessage;
    try {
      errorMessage = JSON.parse(error.message);
    } catch (e) {
      errorMessage = { error: error.message };
    }
    
    return reply.code(400).send({ error: errorMessage });
  }
}