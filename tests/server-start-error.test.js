import { describe, it, expect, vi, beforeAll } from "vitest";

const mockFastify = {
  register: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  post: vi.fn(),
  addHook: vi.fn(),
  listen: vi.fn().mockRejectedValue(new Error("EADDRINUSE")),
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

describe("server.js start error path", () => {
  let exitMock;

  beforeAll(async () => {
    exitMock = vi.spyOn(process, "exit").mockImplementation(() => {});
    // Import server - start() will fail because listen rejects
    await import("../app/server.js");
    // Wait a tick for async start() to complete
    await new Promise((r) => setTimeout(r, 50));
  });

  it("should log error and exit(1) when start fails", () => {
    expect(mockFastify.log.error).toHaveBeenCalledWith(expect.any(Error));
    expect(exitMock).toHaveBeenCalledWith(1);
    exitMock.mockRestore();
  });
});
