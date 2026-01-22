import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before importing the module
vi.mock("puppeteer", () => ({
  default: { launch: vi.fn() },
}));

vi.mock("generic-pool", () => ({
  default: { createPool: vi.fn() },
}));

vi.mock("fs/promises", () => ({
  default: {
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    rm: vi.fn(),
  },
}));

vi.mock("../app/utils/logger.js", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import puppeteer from "puppeteer";
import genericPool from "generic-pool";
import fs from "fs/promises";
import logger from "../app/utils/logger.js";

describe("BrowserPool", () => {
  let BrowserPool;
  let browserPool;
  let mockPool;
  let factory;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.clearAllMocks();

    mockPool = {
      acquire: vi.fn(),
      release: vi.fn(),
      destroy: vi.fn(),
      drain: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      size: 2,
      available: 1,
      borrowed: 1,
      pending: 0,
      max: 5,
      min: 1,
    };

    genericPool.createPool.mockImplementation((f, opts) => {
      factory = f;
      return mockPool;
    });

    // Dynamic import to get a fresh module each time
    const mod = await import("../app/core/browser-pool.js");
    browserPool = mod.default;

    // Reset the pool state
    browserPool.pool = null;
    browserPool.isShuttingDown = false;
    browserPool.cleanupInterval = null;
    browserPool.metrics = {
      totalAcquired: 0,
      totalReleased: 0,
      totalErrors: 0,
      totalRecycled: 0,
      tempFilesCleanedUp: 0,
    };

    // Stub cleanupChromeTempFiles during initialize to avoid side effects
    fs.readdir.mockResolvedValue([]);
  });

  afterEach(() => {
    if (browserPool.cleanupInterval) {
      clearInterval(browserPool.cleanupInterval);
      browserPool.cleanupInterval = null;
    }
    vi.useRealTimers();
  });

  describe("initialize", () => {
    it("should create a pool with default options", () => {
      browserPool.initialize({ warmUp: false });

      expect(genericPool.createPool).toHaveBeenCalledTimes(1);
      const poolOpts = genericPool.createPool.mock.calls[0][1];
      expect(poolOpts.min).toBe(1);
      expect(poolOpts.max).toBe(5);
      expect(poolOpts.testOnBorrow).toBe(true);
    });

    it("should create a pool with custom max", () => {
      browserPool.initialize({ max: 10, warmUp: false });
      const poolOpts = genericPool.createPool.mock.calls[0][1];
      expect(poolOpts.max).toBe(10);
    });

    it("should register pool error event handlers", () => {
      browserPool.initialize({ warmUp: false });
      expect(mockPool.on).toHaveBeenCalledWith("factoryCreateError", expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith("factoryDestroyError", expect.any(Function));
    });

    it("should handle factoryCreateError event", () => {
      browserPool.initialize({ warmUp: false });
      const createErrorHandler = mockPool.on.mock.calls.find(c => c[0] === "factoryCreateError")[1];
      const err = new Error("create failed");
      createErrorHandler(err);
      expect(browserPool.metrics.totalErrors).toBe(1);
      expect(logger.error).toHaveBeenCalled();
    });

    it("should handle factoryDestroyError event", () => {
      browserPool.initialize({ warmUp: false });
      const destroyErrorHandler = mockPool.on.mock.calls.find(c => c[0] === "factoryDestroyError")[1];
      destroyErrorHandler(new Error("destroy failed"));
      expect(browserPool.metrics.totalErrors).toBe(1);
    });

    it("should start periodic cleanup", () => {
      browserPool.initialize({ warmUp: false, cleanupInterval: 60000 });
      expect(browserPool.cleanupInterval).not.toBeNull();
    });

    it("should call warmUp when warmUp is not disabled", () => {
      mockPool.acquire.mockResolvedValue({ browser: {}, page: {} });
      mockPool.release.mockResolvedValue(undefined);
      browserPool.initialize({ warmUp: true });
      // warmUp is called, we just verify no crash
    });

    it("should use custom browserArgs if provided", () => {
      const customArgs = ["--no-sandbox"];
      browserPool.initialize({ warmUp: false, browserArgs: customArgs });
      expect(factory).toBeDefined();
    });

    it("should pass custom pool options", () => {
      browserPool.initialize({ warmUp: false, acquireTimeout: 5000, destroyTimeout: 2000 });
      const poolOpts = genericPool.createPool.mock.calls[0][1];
      expect(poolOpts.acquireTimeoutMillis).toBe(5000);
      expect(poolOpts.destroyTimeoutMillis).toBe(2000);
    });
  });

  describe("factory.create", () => {
    let mockPage, mockBrowser;

    beforeEach(() => {
      mockPage = {
        on: vi.fn(),
        setDefaultNavigationTimeout: vi.fn().mockResolvedValue(undefined),
        setDefaultTimeout: vi.fn().mockResolvedValue(undefined),
        setCacheEnabled: vi.fn().mockResolvedValue(undefined),
        setRequestInterception: vi.fn().mockResolvedValue(undefined),
      };
      mockBrowser = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        on: vi.fn(),
        process: vi.fn().mockReturnValue({ pid: 123 }),
      };
      puppeteer.launch.mockResolvedValue(mockBrowser);
      browserPool.initialize({ warmUp: false });
    });

    it("should create a browser resource", async () => {
      const resource = await factory.create();
      expect(resource).toHaveProperty("browser");
      expect(resource).toHaveProperty("page");
      expect(resource).toHaveProperty("createdAt");
      expect(puppeteer.launch).toHaveBeenCalled();
    });

    it("should set up page error handlers", async () => {
      await factory.create();
      expect(mockPage.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith("pageerror", expect.any(Function));
    });

    it("should emit browserCreated event", async () => {
      const spy = vi.fn();
      browserPool.on("browserCreated", spy);
      await factory.create();
      expect(spy).toHaveBeenCalled();
      browserPool.off("browserCreated", spy);
    });

    it("should increment totalErrors on page error event", async () => {
      await factory.create();
      const errorHandler = mockPage.on.mock.calls.find(c => c[0] === "error")[1];
      errorHandler(new Error("page crash"));
      expect(browserPool.metrics.totalErrors).toBe(1);
    });

    it("should increment totalErrors on pageerror event", async () => {
      await factory.create();
      const handler = mockPage.on.mock.calls.find(c => c[0] === "pageerror")[1];
      handler(new Error("js error"));
      expect(browserPool.metrics.totalErrors).toBe(1);
    });

    it("should retry on failure and succeed", async () => {
      vi.useRealTimers();
      puppeteer.launch
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockResolvedValueOnce(mockBrowser);

      const resource = await factory.create();
      expect(resource.browser).toBe(mockBrowser);
      expect(puppeteer.launch).toHaveBeenCalledTimes(2);
    });

    it("should throw after all retries exhausted", async () => {
      vi.useRealTimers();
      puppeteer.launch.mockRejectedValue(new Error("fail always"));
      await expect(factory.create()).rejects.toThrow("fail always");
      expect(browserPool.metrics.totalErrors).toBe(1);
    });

    it("should enable request interception when blockResources is set", async () => {
      browserPool.pool = null;
      browserPool.initialize({ warmUp: false, blockResources: true });
      await factory.create();
      expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    });

    it("should set up browser disconnected handler", async () => {
      await factory.create();
      expect(mockBrowser.on).toHaveBeenCalledWith("disconnected", expect.any(Function));
    });

    it("should abort blocked resource types", async () => {
      browserPool.pool = null;
      browserPool.initialize({ warmUp: false, blockResources: true });
      await factory.create();

      const requestHandler = mockPage.on.mock.calls.find(c => c[0] === "request")[1];
      const mockReq = { resourceType: () => "image", abort: vi.fn(), continue: vi.fn() };
      requestHandler(mockReq);
      expect(mockReq.abort).toHaveBeenCalled();

      const scriptReq = { resourceType: () => "script", abort: vi.fn(), continue: vi.fn() };
      requestHandler(scriptReq);
      expect(scriptReq.continue).toHaveBeenCalled();
    });
  });

  describe("factory.destroy", () => {
    let mockResource;

    beforeEach(() => {
      const mockPage = {
        removeAllListeners: vi.fn(),
        isClosed: vi.fn().mockReturnValue(false),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockBrowser = {
        removeAllListeners: vi.fn(),
        isConnected: vi.fn().mockReturnValue(true),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockResource = { browser: mockBrowser, page: mockPage, createdAt: Date.now() };
      browserPool.initialize({ warmUp: false });
    });

    it("should close page and browser", async () => {
      await factory.destroy(mockResource);
      expect(mockResource.page.close).toHaveBeenCalled();
      expect(mockResource.browser.close).toHaveBeenCalled();
    });

    it("should emit browserDestroyed event", async () => {
      const spy = vi.fn();
      browserPool.on("browserDestroyed", spy);
      await factory.destroy(mockResource);
      expect(spy).toHaveBeenCalled();
      browserPool.off("browserDestroyed", spy);
    });

    it("should skip close if page is already closed", async () => {
      mockResource.page.isClosed.mockReturnValue(true);
      await factory.destroy(mockResource);
      expect(mockResource.page.close).not.toHaveBeenCalled();
    });

    it("should skip browser close if disconnected", async () => {
      mockResource.browser.isConnected.mockReturnValue(false);
      await factory.destroy(mockResource);
      expect(mockResource.browser.close).not.toHaveBeenCalled();
    });

    it("should handle errors during destroy", async () => {
      mockResource.browser.close.mockRejectedValue(new Error("close error"));
      await factory.destroy(mockResource);
      expect(browserPool.metrics.totalErrors).toBe(1);
    });

    it("should handle null page gracefully", async () => {
      mockResource.page = null;
      await expect(factory.destroy(mockResource)).resolves.not.toThrow();
    });

    it("should handle null browser gracefully", async () => {
      mockResource.browser = null;
      await expect(factory.destroy(mockResource)).resolves.not.toThrow();
    });
  });

  describe("factory.validate", () => {
    let mockResource;

    beforeEach(() => {
      const mockPage = {
        isClosed: vi.fn().mockReturnValue(false),
        evaluate: vi.fn().mockResolvedValue(true),
      };
      const mockBrowser = {
        isConnected: vi.fn().mockReturnValue(true),
        process: vi.fn().mockReturnValue({ pid: 123 }),
        _poolCreatedAt: Date.now(),
        _requestCount: 0,
      };
      mockResource = { browser: mockBrowser, page: mockPage, createdAt: Date.now() };
      browserPool.initialize({ warmUp: false });
    });

    it("should return true for a healthy resource", async () => {
      const result = await factory.validate(mockResource);
      expect(result).toBe(true);
    });

    it("should return false if browser is not connected", async () => {
      mockResource.browser.isConnected.mockReturnValue(false);
      expect(await factory.validate(mockResource)).toBe(false);
    });

    it("should return false if browser is null", async () => {
      mockResource.browser = null;
      expect(await factory.validate(mockResource)).toBe(false);
    });

    it("should return false if page is closed", async () => {
      mockResource.page.isClosed.mockReturnValue(true);
      expect(await factory.validate(mockResource)).toBe(false);
    });

    it("should return false if page is null", async () => {
      mockResource.page = null;
      expect(await factory.validate(mockResource)).toBe(false);
    });

    it("should return false if browser age exceeds max", async () => {
      mockResource.browser._poolCreatedAt = Date.now() - 999999999;
      expect(await factory.validate(mockResource)).toBe(false);
      expect(browserPool.metrics.totalRecycled).toBe(1);
    });

    it("should return false if request count exceeds max", async () => {
      mockResource.browser._requestCount = 9999;
      expect(await factory.validate(mockResource)).toBe(false);
      expect(browserPool.metrics.totalRecycled).toBe(1);
    });

    it("should return false if page is unresponsive", async () => {
      mockResource.page.evaluate.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10))
      );
      vi.useRealTimers();
      expect(await factory.validate(mockResource)).toBe(false);
    });

    it("should handle memory check (high memory)", async () => {
      // Mock process.memoryUsage to report high memory
      const origMemUsage = process.memoryUsage;
      process.memoryUsage = () => ({ heapUsed: 999 * 1024 * 1024, heapTotal: 1024 * 1024 * 1024 });
      const result = await factory.validate(mockResource);
      expect(result).toBe(false);
      process.memoryUsage = origMemUsage;
    });

    it("should handle browser without process", async () => {
      mockResource.browser.process.mockReturnValue(null);
      const result = await factory.validate(mockResource);
      expect(result).toBe(true);
    });
  });

  describe("acquire", () => {
    beforeEach(() => {
      browserPool.initialize({ warmUp: false });
    });

    it("should acquire a resource from the pool", async () => {
      const mockResource = {
        browser: { _requestCount: 0 },
        page: { isClosed: vi.fn().mockReturnValue(false), removeAllListeners: vi.fn(), close: vi.fn().mockResolvedValue(undefined), on: vi.fn() },
      };
      const newPage = { on: vi.fn() };
      mockResource.browser.newPage = vi.fn().mockResolvedValue(newPage);
      mockPool.acquire.mockResolvedValue(mockResource);

      const result = await browserPool.acquire();
      expect(result).toBe(mockResource);
      expect(browserPool.metrics.totalAcquired).toBe(1);
    });

    it("should throw if pool is shutting down", async () => {
      browserPool.isShuttingDown = true;
      await expect(browserPool.acquire()).rejects.toThrow("Browser pool is shutting down");
    });

    it("should retry on failure", async () => {
      const mockResource = {
        browser: { _requestCount: 0, newPage: vi.fn().mockResolvedValue({ on: vi.fn() }) },
        page: { isClosed: vi.fn().mockReturnValue(false), removeAllListeners: vi.fn(), close: vi.fn().mockResolvedValue(undefined), on: vi.fn() },
      };
      mockPool.acquire
        .mockRejectedValueOnce(new Error("busy"))
        .mockResolvedValueOnce(mockResource);

      vi.useRealTimers();
      const result = await browserPool.acquire({ retries: 2 });
      expect(result).toBe(mockResource);
    });

    it("should throw after all retries exhausted", async () => {
      mockPool.acquire.mockRejectedValue(new Error("failed"));
      vi.useRealTimers();
      await expect(browserPool.acquire({ retries: 1 })).rejects.toThrow("failed");
      expect(browserPool.metrics.totalErrors).toBe(1);
    });

    it("should emit browserAcquired event", async () => {
      const mockResource = {
        browser: { _requestCount: 0, newPage: vi.fn().mockResolvedValue({ on: vi.fn() }) },
        page: { isClosed: vi.fn().mockReturnValue(false), removeAllListeners: vi.fn(), close: vi.fn().mockResolvedValue(undefined), on: vi.fn() },
      };
      mockPool.acquire.mockResolvedValue(mockResource);

      const spy = vi.fn();
      browserPool.on("browserAcquired", spy);
      await browserPool.acquire();
      expect(spy).toHaveBeenCalled();
      browserPool.off("browserAcquired", spy);
    });
  });

  describe("resetPage", () => {
    beforeEach(() => {
      browserPool.initialize({ warmUp: false });
    });

    it("should close old page and create new one", async () => {
      const newPage = { on: vi.fn() };
      const resource = {
        browser: { newPage: vi.fn().mockResolvedValue(newPage) },
        page: { isClosed: vi.fn().mockReturnValue(false), removeAllListeners: vi.fn(), close: vi.fn().mockResolvedValue(undefined) },
      };

      await browserPool.resetPage(resource);
      expect(resource.page).toBe(newPage);
    });

    it("should skip close if page is already closed", async () => {
      const newPage = { on: vi.fn() };
      const oldPage = { isClosed: vi.fn().mockReturnValue(true), removeAllListeners: vi.fn(), close: vi.fn() };
      const resource = {
        browser: { newPage: vi.fn().mockResolvedValue(newPage) },
        page: oldPage,
      };

      await browserPool.resetPage(resource);
      expect(oldPage.close).not.toHaveBeenCalled();
    });

    it("should handle null page", async () => {
      const newPage = { on: vi.fn() };
      const resource = {
        browser: { newPage: vi.fn().mockResolvedValue(newPage) },
        page: null,
      };

      await browserPool.resetPage(resource);
      expect(resource.page).toBe(newPage);
    });

    it("should set up error handlers on new page", async () => {
      const newPage = { on: vi.fn() };
      const resource = {
        browser: { newPage: vi.fn().mockResolvedValue(newPage) },
        page: null,
      };

      await browserPool.resetPage(resource);
      expect(newPage.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(newPage.on).toHaveBeenCalledWith("pageerror", expect.any(Function));
    });

    it("should handle errors gracefully", async () => {
      const resource = {
        browser: { newPage: vi.fn().mockRejectedValue(new Error("fail")) },
        page: null,
      };

      await expect(browserPool.resetPage(resource)).resolves.not.toThrow();
    });
  });

  describe("release", () => {
    beforeEach(() => {
      browserPool.initialize({ warmUp: false });
    });

    it("should release resource back to pool", async () => {
      const resource = {};
      await browserPool.release(resource);
      expect(mockPool.release).toHaveBeenCalledWith(resource);
      expect(browserPool.metrics.totalReleased).toBe(1);
    });

    it("should destroy resource when destroy option is true", async () => {
      const resource = {};
      await browserPool.release(resource, { destroy: true });
      expect(mockPool.destroy).toHaveBeenCalledWith(resource);
    });

    it("should emit browserReleased event", async () => {
      const spy = vi.fn();
      browserPool.on("browserReleased", spy);
      await browserPool.release({});
      expect(spy).toHaveBeenCalled();
      browserPool.off("browserReleased", spy);
    });

    it("should try to destroy on release error", async () => {
      mockPool.release.mockRejectedValue(new Error("release failed"));
      await browserPool.release({});
      expect(mockPool.destroy).toHaveBeenCalled();
      expect(browserPool.metrics.totalErrors).toBe(1);
    });

    it("should handle both release and destroy failures", async () => {
      mockPool.release.mockRejectedValue(new Error("release failed"));
      mockPool.destroy.mockRejectedValue(new Error("destroy also failed"));
      await browserPool.release({});
      expect(browserPool.metrics.totalErrors).toBe(1);
    });
  });

  describe("drain", () => {
    beforeEach(() => {
      browserPool.initialize({ warmUp: false });
    });

    it("should set isShuttingDown and drain pool", async () => {
      await browserPool.drain();
      expect(browserPool.isShuttingDown).toBe(true);
      expect(mockPool.drain).toHaveBeenCalled();
      expect(mockPool.clear).toHaveBeenCalled();
    });

    it("should emit poolDrained event", async () => {
      const spy = vi.fn();
      browserPool.on("poolDrained", spy);
      await browserPool.drain();
      expect(spy).toHaveBeenCalled();
      browserPool.off("poolDrained", spy);
    });

    it("should stop periodic cleanup", async () => {
      await browserPool.drain();
      expect(browserPool.cleanupInterval).toBeNull();
    });

    it("should handle drain errors", async () => {
      mockPool.drain.mockRejectedValue(new Error("drain error"));
      await expect(browserPool.drain()).resolves.not.toThrow();
    });
  });

  describe("getStats", () => {
    it("should return null if pool is not initialized", () => {
      browserPool.pool = null;
      expect(browserPool.getStats()).toBeNull();
    });

    it("should return pool statistics", () => {
      browserPool.initialize({ warmUp: false });
      const stats = browserPool.getStats();
      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("available");
      expect(stats).toHaveProperty("borrowed");
      expect(stats).toHaveProperty("metrics");
    });
  });

  describe("healthCheck", () => {
    beforeEach(() => {
      browserPool.initialize({ warmUp: false });
    });

    it("should return healthy status", async () => {
      const health = await browserPool.healthCheck();
      expect(health.status).toBe("healthy");
      expect(health).toHaveProperty("stats");
      expect(health).toHaveProperty("uptime");
    });

    it("should return shutting_down status", async () => {
      browserPool.isShuttingDown = true;
      const health = await browserPool.healthCheck();
      expect(health.status).toBe("shutting_down");
    });

    it("should return degraded when high pending requests", async () => {
      mockPool.available = 0;
      mockPool.pending = 3;
      const health = await browserPool.healthCheck();
      expect(health.status).toBe("degraded");
      expect(health.reason).toContain("pending");
    });

    it("should return degraded when high error count", async () => {
      browserPool.metrics.totalErrors = 101;
      const health = await browserPool.healthCheck();
      expect(health.status).toBe("degraded");
      expect(health.reason).toContain("error");
    });

    it("should return unhealthy on exception", async () => {
      browserPool.pool = null;
      // getStats returns null, accessing null.available throws
      Object.defineProperty(browserPool, 'getStats', {
        value: () => { throw new Error("broken"); },
        writable: true,
        configurable: true,
      });
      const health = await browserPool.healthCheck();
      expect(health.status).toBe("unhealthy");
    });
  });

  describe("cleanupChromeTempFiles", () => {
    beforeEach(() => {
      browserPool.initialize({ warmUp: false });
    });

    it("should remove old Chrome temp files", async () => {
      const before = browserPool.metrics.tempFilesCleanedUp;
      const entries = [
        { name: ".com.google.Chrome.abcdef", isFile: () => true, isDirectory: () => false },
      ];
      fs.readdir.mockResolvedValue(entries);
      fs.stat.mockResolvedValue({ mtimeMs: Date.now() - 999999999 });
      fs.unlink.mockResolvedValue(undefined);

      await browserPool.cleanupChromeTempFiles();
      expect(fs.unlink).toHaveBeenCalled();
      expect(browserPool.metrics.tempFilesCleanedUp).toBe(before + 1);
    });

    it("should remove old puppeteer profile dirs", async () => {
      const entries = [
        { name: "puppeteer_dev_chrome_profile-xyz", isFile: () => false, isDirectory: () => true },
      ];
      fs.readdir.mockResolvedValue(entries);
      fs.stat.mockResolvedValue({ mtimeMs: Date.now() - 999999999 });
      fs.rm.mockResolvedValue(undefined);

      await browserPool.cleanupChromeTempFiles();
      expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining("puppeteer_dev_chrome_profile"), { recursive: true, force: true });
    });

    it("should remove old Crashpad dirs", async () => {
      const entries = [
        { name: "Crashpad", isFile: () => false, isDirectory: () => true },
      ];
      fs.readdir.mockResolvedValue(entries);
      fs.stat.mockResolvedValue({ mtimeMs: Date.now() - 999999999 });
      fs.rm.mockResolvedValue(undefined);

      await browserPool.cleanupChromeTempFiles();
      expect(fs.rm).toHaveBeenCalled();
    });

    it("should skip files that are not old enough", async () => {
      const entries = [
        { name: ".com.google.Chrome.recent", isFile: () => true, isDirectory: () => false },
      ];
      fs.readdir.mockResolvedValue(entries);
      fs.stat.mockResolvedValue({ mtimeMs: Date.now() });

      await browserPool.cleanupChromeTempFiles();
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it("should handle readdir failure gracefully", async () => {
      fs.readdir.mockRejectedValue(new Error("ENOENT"));
      await expect(browserPool.cleanupChromeTempFiles()).resolves.not.toThrow();
    });

    it("should handle individual file stat errors", async () => {
      const before = browserPool.metrics.tempFilesCleanedUp;
      const entries = [
        { name: ".com.google.Chrome.abc", isFile: () => true, isDirectory: () => false },
      ];
      fs.readdir.mockResolvedValue(entries);
      fs.stat.mockRejectedValue(new Error("ENOENT"));

      await browserPool.cleanupChromeTempFiles();
      expect(browserPool.metrics.tempFilesCleanedUp).toBe(before + 1);
    });

    it("should emit tempFilesCleanedUp event", async () => {
      fs.readdir.mockResolvedValue([]);
      const spy = vi.fn();
      browserPool.on("tempFilesCleanedUp", spy);
      await browserPool.cleanupChromeTempFiles();
      expect(spy).toHaveBeenCalled();
      browserPool.off("tempFilesCleanedUp", spy);
    });
  });

  describe("startPeriodicCleanup / stopPeriodicCleanup", () => {
    it("should clear existing interval before starting new one", () => {
      browserPool.cleanupInterval = setInterval(() => {}, 99999);
      browserPool.startPeriodicCleanup(60000);
      expect(browserPool.cleanupInterval).not.toBeNull();
    });

    it("should stop cleanup interval", () => {
      browserPool.initialize({ warmUp: false });
      browserPool.stopPeriodicCleanup();
      expect(browserPool.cleanupInterval).toBeNull();
    });

    it("should do nothing if no interval exists", () => {
      browserPool.cleanupInterval = null;
      browserPool.stopPeriodicCleanup();
      expect(browserPool.cleanupInterval).toBeNull();
    });
  });

  describe("warmUp", () => {
    beforeEach(() => {
      browserPool.initialize({ warmUp: false });
    });

    it("should acquire and release min number of browsers", async () => {
      const resource = { browser: {}, page: {} };
      mockPool.acquire.mockResolvedValue(resource);
      mockPool.release.mockResolvedValue(undefined);

      await browserPool.warmUp();
      expect(mockPool.acquire).toHaveBeenCalled();
      expect(mockPool.release).toHaveBeenCalled();
    });

    it("should handle warmup failures gracefully", async () => {
      mockPool.acquire.mockRejectedValue(new Error("warmup fail"));
      await expect(browserPool.warmUp()).resolves.not.toThrow();
    });
  });
});
