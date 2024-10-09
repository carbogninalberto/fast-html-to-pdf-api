import { PuppeteerWrapper } from "../core/wrapper.js";
/**
 * Render controller for handling rendering requests
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function renderController(request, reply) {
  try {
    let config;
    if (request.method === "GET") {
      config = JSON.parse(request.query.config);
    } else {
      config = request.body;
    }

    const wrapper = new PuppeteerWrapper(config);

    try {
      await wrapper.initialize();
      const { content, contentType, filename } = await wrapper.captureOutput();

      reply.header("Content-Type", contentType);
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);
      return reply.send(content);
    } catch (error) {
      console.error("Rendering error:", error);
      return reply
        .code(500)
        .send({ error: "An error occurred during rendering" });
    } finally {
      await wrapper.close();
    }
  } catch (error) {
    let errorMessage = JSON.parse(error.message);
    return reply.code(400).send({ error: errorMessage });
  }
}
