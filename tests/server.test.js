import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";

const mockFastify = {
  register: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  post: vi.fn(),
  addHook: vi.fn(),
  listen: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  log: { error: vi.fn() },
};

vi.mock("fastify", () => ({
  default: function Fastify(opts) {
    mockFastify._opts = opts;
    return mockFastify;
  },
}));

vi.mock("@fastify/swagger", () => ({ default: "swagger-plugin" }));
vi.mock("@fastify/swagger-ui", () => ({ default: "swagger-ui-plugin" }));

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn().mockResolvedValue(JSON.stringify({ openapi: "3.0.0", info: { title: "test" } })),
  },
}));

const mockBrowserPool = {
  initialize: vi.fn(),
  warmUp: vi.fn().mockResolvedValue(undefined),
  drain: vi.fn().mockResolvedValue(undefined),
  getStats: vi.fn().mockReturnValue({ available: 2, borrowed: 0, pending: 0, size: 2 }),
};

vi.mock("../app/core/browser-pool.js", () => ({
  default: mockBrowserPool,
}));

vi.mock("../app/utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../app/controllers/render.js", () => ({
  renderController: vi.fn(),
}));

vi.mock("../app/config/constants.js", () => ({
  SERVER_PORT: 3000,
  PLUGIN_TIMEOUT_MS: 60000,
  BODY_LIMIT_BYTES: 50 * 1024 * 1024,
  SHUTDOWN_TIMEOUT_MS: 30000,
  POOL_MIN: 2,
  POOL_MAX: 10,
  POOL_ACQUIRE_TIMEOUT_MS: 30000,
  POOL_CREATE_TIMEOUT_MS: 30000,
  POOL_IDLE_TIMEOUT_MS: 30000,
}));

describe("server.js", () => {
  beforeAll(async () => {
    // Import server to trigger top-level execution
    await import("../app/server.js");
  });

  it("should create Fastify instance with logger enabled", () => {
    expect(mockFastify._opts.logger).toBe(true);
  });

  it("should register swagger plugins", () => {
    expect(mockFastify.register).toHaveBeenCalledTimes(2);
  });

  it("should register GET / route", () => {
    const rootCall = mockFastify.get.mock.calls.find(c => c[0] === "/");
    expect(rootCall).toBeDefined();
  });

  it("should GET / return info object", () => {
    const rootCall = mockFastify.get.mock.calls.find(c => c[0] === "/");
    const reply = { send: vi.fn() };
    rootCall[1]({}, reply);
    expect(reply.send).toHaveBeenCalledWith({ info: "Html2Pdf API" });
  });

  it("should register GET /ping route", () => {
    const pingCall = mockFastify.get.mock.calls.find(c => c[0] === "/ping");
    expect(pingCall).toBeDefined();
  });

  it("should GET /ping return pong", () => {
    const pingCall = mockFastify.get.mock.calls.find(c => c[0] === "/ping");
    const reply = { send: vi.fn() };
    pingCall[1]({}, reply);
    expect(reply.send).toHaveBeenCalledWith("pong");
  });

  it("should register GET /health route", () => {
    const healthCall = mockFastify.get.mock.calls.find(c => c[0] === "/health");
    expect(healthCall).toBeDefined();
  });

  it("should return healthy when browsers available", () => {
    mockBrowserPool.getStats.mockReturnValue({ available: 2, borrowed: 0, pending: 0, size: 2 });
    const healthCall = mockFastify.get.mock.calls.find(c => c[0] === "/health");
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    healthCall[1]({}, reply);
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ status: "healthy" }));
  });

  it("should return 503 degraded when no browsers available", () => {
    mockBrowserPool.getStats.mockReturnValue({ available: 0, borrowed: 5, pending: 2, size: 5 });
    const healthCall = mockFastify.get.mock.calls.find(c => c[0] === "/health");
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    healthCall[1]({}, reply);
    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ status: "degraded" }));
  });

  it("should handle null pool stats in health check", () => {
    mockBrowserPool.getStats.mockReturnValue(null);
    const healthCall = mockFastify.get.mock.calls.find(c => c[0] === "/health");
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    healthCall[1]({}, reply);
    expect(reply.code).toHaveBeenCalledWith(503);
  });

  it("should register POST /render route", () => {
    const renderPost = mockFastify.post.mock.calls.find(c => c[0] === "/render");
    expect(renderPost).toBeDefined();
  });

  it("should register GET /render route", () => {
    const renderGet = mockFastify.get.mock.calls.find(c => c[0] === "/render");
    expect(renderGet).toBeDefined();
  });

  it("should register onClose hook", () => {
    expect(mockFastify.addHook).toHaveBeenCalledWith("onClose", expect.any(Function));
  });

  it("should drain browser pool on close hook", async () => {
    const closeHook = mockFastify.addHook.mock.calls.find(c => c[0] === "onClose");
    await closeHook[1]();
    expect(mockBrowserPool.drain).toHaveBeenCalled();
  });

  it("should initialize browser pool", () => {
    expect(mockBrowserPool.initialize).toHaveBeenCalledWith(expect.objectContaining({
      min: 2,
      max: 10,
      warmUp: false,
    }));
  });

  it("should warm up browser pool", () => {
    expect(mockBrowserPool.warmUp).toHaveBeenCalled();
  });

  it("should listen on port 3000", () => {
    expect(mockFastify.listen).toHaveBeenCalledWith({ port: 3000, host: "0.0.0.0" });
  });

  it("should register SIGINT handler", () => {
    expect(process.listenerCount("SIGINT")).toBeGreaterThan(0);
  });

  it("should register SIGTERM handler", () => {
    expect(process.listenerCount("SIGTERM")).toBeGreaterThan(0);
  });

  it("should call fastify.close on shutdown", async () => {
    // Get the SIGTERM handler and call it with mocked process.exit
    const origExit = process.exit;
    process.exit = vi.fn();

    // Find the last SIGTERM listener (ours)
    const listeners = process.listeners("SIGTERM");
    const shutdownHandler = listeners[listeners.length - 1];

    if (shutdownHandler) {
      await shutdownHandler();
      expect(mockFastify.close).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    }

    process.exit = origExit;
  });

  it("should handle shutdown errors", async () => {
    mockFastify.close.mockRejectedValueOnce(new Error("close error"));
    const origExit = process.exit;
    process.exit = vi.fn();

    const listeners = process.listeners("SIGINT");
    const shutdownHandler = listeners[listeners.length - 1];

    if (shutdownHandler) {
      await shutdownHandler();
      expect(process.exit).toHaveBeenCalledWith(0);
    }

    process.exit = origExit;
  });

  it("should invoke swagger-ui uiHooks onRequest callback", () => {
    // Second register call is for swagger-ui
    const swaggerUiCall = mockFastify.register.mock.calls[1];
    const opts = swaggerUiCall[1];
    const next = vi.fn();
    opts.uiHooks.onRequest({}, {}, next);
    expect(next).toHaveBeenCalled();
  });

  it("should invoke swagger-ui uiHooks preHandler callback", () => {
    const swaggerUiCall = mockFastify.register.mock.calls[1];
    const opts = swaggerUiCall[1];
    const next = vi.fn();
    opts.uiHooks.preHandler({}, {}, next);
    expect(next).toHaveBeenCalled();
  });

  it("should invoke transformStaticCSP callback", () => {
    const swaggerUiCall = mockFastify.register.mock.calls[1];
    const opts = swaggerUiCall[1];
    const result = opts.transformStaticCSP("test-header");
    expect(result).toBe("test-header");
  });

  it("should invoke transformSpecification callback", () => {
    const swaggerUiCall = mockFastify.register.mock.calls[1];
    const opts = swaggerUiCall[1];
    const swaggerObj = { openapi: "3.0.0" };
    const result = opts.transformSpecification(swaggerObj, {}, {});
    expect(result).toBe(swaggerObj);
  });

  it("should force exit on shutdown timeout when close hangs", async () => {
    vi.useFakeTimers();
    // Make close hang forever (never resolves)
    mockFastify.close.mockReturnValueOnce(new Promise(() => {}));
    const origExit = process.exit;
    process.exit = vi.fn();

    const listeners = process.listeners("SIGTERM");
    const shutdownHandler = listeners[listeners.length - 1];

    if (shutdownHandler) {
      // Don't await - it will never complete since close hangs
      shutdownHandler();
      // Advance past SHUTDOWN_TIMEOUT_MS (30000)
      await vi.advanceTimersByTimeAsync(30001);
      expect(process.exit).toHaveBeenCalledWith(1);
    }

    process.exit = origExit;
    vi.useRealTimers();
  });
});
