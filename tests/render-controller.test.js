import { describe, it, expect, vi, beforeEach } from "vitest";

const mockWrapper = {
  initialize: vi.fn().mockResolvedValue(undefined),
  captureOutput: vi.fn().mockResolvedValue({
    content: Buffer.from("result"),
    contentType: "image/png",
    filename: "image-example-123.png",
  }),
  close: vi.fn().mockResolvedValue(undefined),
  constructorError: null,
};

vi.mock("../app/core/wrapper.js", () => ({
  PuppeteerWrapper: class MockPuppeteerWrapper {
    constructor(config) {
      if (mockWrapper.constructorError) {
        throw mockWrapper.constructorError;
      }
      this._config = config;
      this.initialize = mockWrapper.initialize;
      this.captureOutput = mockWrapper.captureOutput;
      this.close = mockWrapper.close;
    }
  },
}));

vi.mock("../app/core/browser-pool.js", () => ({
  default: {
    getStats: vi.fn().mockReturnValue({ available: 2, borrowed: 1, pending: 0 }),
  },
}));

import { renderController } from "../app/controllers/render.js";
import browserPool from "../app/core/browser-pool.js";
import { createMockRequest, createMockReply } from "./__mocks__/helpers.js";

describe("renderController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWrapper.constructorError = null;
    mockWrapper.initialize.mockResolvedValue(undefined);
    mockWrapper.captureOutput.mockResolvedValue({
      content: Buffer.from("result"),
      contentType: "image/png",
      filename: "image-example-123.png",
    });
    mockWrapper.close.mockResolvedValue(undefined);
  });

  it("should handle POST request with body config", async () => {
    const request = createMockRequest({ method: "POST", body: { url: "https://example.com", type: "image" } });
    const reply = createMockReply();

    await renderController(request, reply);

    expect(mockWrapper.initialize).toHaveBeenCalled();
    expect(mockWrapper.captureOutput).toHaveBeenCalled();
    expect(reply.header).toHaveBeenCalledWith("Content-Type", "image/png");
    expect(reply.send).toHaveBeenCalledWith(Buffer.from("result"));
  });

  it("should handle GET request with config query param", async () => {
    const config = JSON.stringify({ url: "https://example.com", type: "pdf" });
    const request = createMockRequest({ method: "GET", query: { config }, body: null });
    const reply = createMockReply();

    await renderController(request, reply);

    expect(mockWrapper.initialize).toHaveBeenCalled();
  });

  it("should return 400 for invalid JSON in GET config", async () => {
    const request = createMockRequest({ method: "GET", query: { config: "not-json" }, body: null });
    const reply = createMockReply();

    await renderController(request, reply);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: "Invalid JSON in config query parameter" });
  });

  it("should set Content-Disposition header", async () => {
    const request = createMockRequest();
    const reply = createMockReply();

    await renderController(request, reply);

    expect(reply.header).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringContaining("attachment")
    );
  });

  it("should set X-Browser-Pool-Stats header", async () => {
    const request = createMockRequest();
    const reply = createMockReply();

    await renderController(request, reply);

    expect(reply.header).toHaveBeenCalledWith("X-Browser-Pool-Stats", expect.any(String));
  });

  it("should not set pool stats header when stats are null", async () => {
    browserPool.getStats.mockReturnValue(null);
    const request = createMockRequest();
    const reply = createMockReply();

    await renderController(request, reply);

    expect(reply.header).not.toHaveBeenCalledWith("X-Browser-Pool-Stats", expect.anything());
  });

  it("should return 503 for pool errors", async () => {
    mockWrapper.captureOutput.mockRejectedValue(new Error("pool is exhausted"));
    const request = createMockRequest();
    const reply = createMockReply();

    await renderController(request, reply);

    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith({ error: "Service temporarily unavailable" });
  });

  it("should return 500 for generic rendering errors", async () => {
    mockWrapper.captureOutput.mockRejectedValue(new Error("something broke"));
    const request = createMockRequest();
    const reply = createMockReply();

    await renderController(request, reply);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({ error: "An error occurred during rendering" });
  });

  it("should call wrapper.close in finally block", async () => {
    mockWrapper.captureOutput.mockRejectedValue(new Error("fail"));
    const request = createMockRequest();
    const reply = createMockReply();

    await renderController(request, reply);

    expect(mockWrapper.close).toHaveBeenCalled();
  });

  it("should handle cleanup errors gracefully", async () => {
    mockWrapper.close.mockRejectedValue(new Error("cleanup failed"));
    const request = createMockRequest();
    const reply = createMockReply();

    // Should not throw even if close fails
    await renderController(request, reply);

    expect(request.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "Error during cleanup"
    );
    // The response should still be sent successfully
    expect(reply.send).toHaveBeenCalled();
  });

  it("should return 400 for validation errors with JSON summary", async () => {
    mockWrapper.constructorError = new Error(JSON.stringify({ summary: "Invalid config", details: [{ path: "type", message: "bad" }] }));
    const request = createMockRequest();
    const reply = createMockReply();

    await renderController(request, reply);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: "Invalid configuration" }));
  });

  it("should return 400 for non-JSON error messages", async () => {
    mockWrapper.constructorError = new Error("bad config");
    const request = createMockRequest();
    const reply = createMockReply();

    await renderController(request, reply);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: "bad config" });
  });

  it("should return 400 with 'Bad request' when error has no message", async () => {
    mockWrapper.constructorError = new Error("");
    const request = createMockRequest();
    const reply = createMockReply();

    await renderController(request, reply);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: "Bad request" });
  });
});
