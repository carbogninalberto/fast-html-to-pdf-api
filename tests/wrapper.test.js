import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../app/core/browser-pool.js", () => ({
  default: {
    acquire: vi.fn(),
    release: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({ available: 1, borrowed: 1, pending: 0 }),
  },
}));

vi.mock("../app/core/image.js", () => ({
  captureImage: vi.fn().mockResolvedValue(Buffer.from("img-data")),
}));

vi.mock("../app/core/pdf.js", () => ({
  capturePDF: vi.fn().mockResolvedValue(Buffer.from("pdf-data")),
}));

vi.mock("../app/core/video.js", () => ({
  captureVideo: vi.fn().mockResolvedValue(Buffer.from("video-data")),
}));

vi.mock("../app/core/html.js", () => ({
  captureHTML: vi.fn().mockResolvedValue(Buffer.from("<html></html>")),
}));

vi.mock("../app/core/cookies.js", () => ({
  blockCookies: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../app/utils/validator.js", () => ({
  validateConfig: vi.fn().mockReturnValue({ error: false }),
}));

import { PuppeteerWrapper } from "../app/core/wrapper.js";
import browserPool from "../app/core/browser-pool.js";
import { captureImage } from "../app/core/image.js";
import { capturePDF } from "../app/core/pdf.js";
import { captureVideo } from "../app/core/video.js";
import { captureHTML } from "../app/core/html.js";
import { blockCookies } from "../app/core/cookies.js";
import { validateConfig } from "../app/utils/validator.js";
import { createMockPage } from "./__mocks__/helpers.js";

describe("PuppeteerWrapper", () => {
  let mockPage;
  let mockResource;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = createMockPage();
    mockResource = {
      browser: { _requestCount: 0 },
      page: mockPage,
    };
    browserPool.acquire.mockResolvedValue(mockResource);
  });

  describe("constructor", () => {
    it("should set default values when no config provided", () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      expect(w.url).toBe("https://example.com");
      expect(w.type).toBe("image");
      expect(w.device.width).toBe(1920);
      expect(w.device.height).toBe(1080);
    });

    it("should merge image config with defaults", () => {
      const w = new PuppeteerWrapper({
        url: "https://example.com",
        type: "image",
        image: { type: "jpeg", quality: 80 },
      });
      expect(w.image.type).toBe("jpeg");
      expect(w.image.quality).toBe(80);
      expect(w.image.resize).toBe(1); // default preserved
    });

    it("should merge video config with defaults", () => {
      const w = new PuppeteerWrapper({
        url: "https://example.com",
        type: "video",
        video: { fps: 30 },
      });
      expect(w.video.fps).toBe(30);
      expect(w.video.videoCodec).toBe("libx264"); // default
    });

    it("should merge pdf config with defaults", () => {
      const w = new PuppeteerWrapper({
        url: "https://example.com",
        type: "pdf",
        pdf: { landscape: true },
      });
      expect(w.pdf.landscape).toBe(true);
      expect(w.pdf.format).toBe("A4"); // default
    });

    it("should set render options", () => {
      const w = new PuppeteerWrapper({
        url: "https://example.com",
        type: "image",
        render: { waitTime: 500, fullPage: true, scroll: { animate: true } },
      });
      expect(w.render.waitTime).toBe(500);
      expect(w.render.fullPage).toBe(true);
      expect(w.render.scroll.animate).toBe(true);
    });

    it("should set device config", () => {
      const w = new PuppeteerWrapper({
        url: "https://example.com",
        type: "image",
        device: { width: 800, height: 600, scale: 2 },
      });
      expect(w.device.width).toBe(800);
      expect(w.device.height).toBe(600);
      expect(w.device.scale).toBe(2);
    });

    it("should set custom headers", () => {
      const w = new PuppeteerWrapper({
        url: "https://example.com",
        type: "image",
        headers: { "X-Custom": "value" },
      });
      expect(w.headers["X-Custom"]).toBe("value");
    });

    it("should accept html content instead of url", () => {
      const w = new PuppeteerWrapper({
        html: "<h1>hello</h1>",
        type: "image",
      });
      expect(w.html).toBe("<h1>hello</h1>");
      expect(w.url).toBe("");
    });

    it("should throw on invalid config", () => {
      validateConfig.mockReturnValue({ error: true, message: { summary: "bad" } });
      expect(() => new PuppeteerWrapper({ type: "invalid" })).toThrow();
      validateConfig.mockReturnValue({ error: false });
    });

    it("should set render block options", () => {
      const w = new PuppeteerWrapper({
        url: "https://example.com",
        type: "image",
        render: { block: { cookies: true, ads: true } },
      });
      expect(w.render.block.cookies).toBe(true);
      expect(w.render.block.ads).toBe(true);
    });
  });

  describe("objectRecursiveMerge", () => {
    it("should merge nested objects", () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      const result = w.objectRecursiveMerge({ a: { b: 1, c: 2 } }, { a: { b: 10 } });
      expect(result.a.b).toBe(10);
      expect(result.a.c).toBe(2);
    });

    it("should return source if target is not object", () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      expect(w.objectRecursiveMerge("str", { a: 1 })).toEqual({ a: 1 });
    });

    it("should return source if source is not object", () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      expect(w.objectRecursiveMerge({ a: 1 }, "str")).toBe("str");
    });

    it("should handle arrays (not merge deeply)", () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      const result = w.objectRecursiveMerge({ a: [1, 2] }, { a: [3, 4] });
      expect(result.a).toEqual([3, 4]);
    });

    it("should handle null source values", () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      const result = w.objectRecursiveMerge({ a: { b: 1 } }, { a: null });
      expect(result.a).toBeNull();
    });
  });

  describe("initialize", () => {
    it("should acquire a browser from the pool", async () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      await w.initialize();
      expect(browserPool.acquire).toHaveBeenCalled();
      expect(w.browser).toBeDefined();
      expect(w.page).toBeDefined();
    });

    it("should set viewport, user agent, and headers", async () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      await w.initialize();
      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });
      expect(mockPage.setUserAgent).toHaveBeenCalled();
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalled();
    });

    it("should set Accept-Language header from locale", async () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image", device: { locale: "fr-FR" } });
      await w.initialize();
      const headers = mockPage.setExtraHTTPHeaders.mock.calls[0][0];
      expect(headers["Accept-Language"]).toBe("fr-FR");
    });

    it("should emulate timezone if set", async () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image", device: { timezone: "Europe/London" } });
      await w.initialize();
      expect(mockPage.emulateTimezone).toHaveBeenCalledWith("Europe/London");
    });

    it("should set javascript enabled", async () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image", device: { javascriptEnabled: false } });
      await w.initialize();
      expect(mockPage.setJavaScriptEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe("captureOutput", () => {
    let wrapper;

    beforeEach(async () => {
      wrapper = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      await wrapper.initialize();
    });

    it("should throw if page not initialized", async () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      await expect(w.captureOutput()).rejects.toThrow("Page not initialized");
    });

    it("should navigate to URL", async () => {
      await wrapper.captureOutput();
      expect(mockPage.goto).toHaveBeenCalledWith("https://example.com", { waitUntil: "networkidle0" });
    });

    it("should use setContent for html input", async () => {
      const w = new PuppeteerWrapper({ html: "<h1>test</h1>", type: "image" });
      await w.initialize();
      await w.captureOutput();
      expect(mockPage.setContent).toHaveBeenCalledWith("<h1>test</h1>", { waitUntil: "load" });
    });

    it("should use waitUntil as-is for html when not networkidle", async () => {
      const w = new PuppeteerWrapper({ html: "<h1>test</h1>", type: "image", render: { waitUntil: "domcontentloaded" } });
      await w.initialize();
      await w.captureOutput();
      expect(mockPage.setContent).toHaveBeenCalledWith("<h1>test</h1>", { waitUntil: "domcontentloaded" });
    });

    it("should throw if no url or html", async () => {
      const w = new PuppeteerWrapper({ url: "", html: "", type: "image" });
      w.page = mockPage; // bypass initialize
      await expect(w.captureOutput()).rejects.toThrow("Either URL or HTML content must be provided");
    });

    it("should wait for waitTime", async () => {
      wrapper.render.waitTime = 10;
      await wrapper.captureOutput();
      expect(mockPage.goto).toHaveBeenCalled();
    });

    it("should trigger lazy animations when configured", async () => {
      wrapper.render.triggerLazyAnimations = true;
      mockPage.evaluate.mockResolvedValue(undefined);
      await wrapper.captureOutput();
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it("should block cookies when configured", async () => {
      wrapper.render.block.cookies = true;
      await wrapper.captureOutput();
      expect(blockCookies).toHaveBeenCalledWith(mockPage);
    });

    it("should capture image type", async () => {
      const result = await wrapper.captureOutput();
      expect(captureImage).toHaveBeenCalled();
      expect(result.contentType).toBe("image/png");
      expect(result.filename).toContain("image-");
    });

    it("should capture pdf type", async () => {
      wrapper.type = "pdf";
      const result = await wrapper.captureOutput();
      expect(capturePDF).toHaveBeenCalled();
      expect(result.contentType).toBe("application/pdf");
    });

    it("should capture video type", async () => {
      wrapper.type = "video";
      const result = await wrapper.captureOutput();
      expect(captureVideo).toHaveBeenCalled();
      expect(result.contentType).toBe("video/mp4");
    });

    it("should capture html type", async () => {
      wrapper.type = "html";
      const result = await wrapper.captureOutput();
      expect(captureHTML).toHaveBeenCalled();
      expect(result.contentType).toBe("text/html");
    });

    it("should throw on invalid type", async () => {
      wrapper.type = "invalid";
      await expect(wrapper.captureOutput()).rejects.toThrow("Invalid capture type");
    });

    it("should use 'html-content' in filename when using html input", async () => {
      const w = new PuppeteerWrapper({ html: "<h1>hi</h1>", type: "image" });
      await w.initialize();
      const result = await w.captureOutput();
      expect(result.filename).toContain("html-content");
    });
  });

  describe("renderLazyAnimations", () => {
    it("should call page.evaluate with scroll function", async () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      await w.initialize();
      mockPage.evaluate.mockResolvedValue(undefined);
      await w.renderLazyAnimations();
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it("should execute the evaluate callback to completion", async () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      await w.initialize();

      mockPage.evaluate.mockImplementation(async (fn) => {
        // Mock browser globals for the scroll animation
        const origWindow = globalThis.window;
        const origDocument = globalThis.document;
        const origPerformance = globalThis.performance;
        const origRAF = globalThis.requestAnimationFrame;

        let startTime = 0;
        globalThis.performance = { now: () => startTime };
        globalThis.window = { scrollY: 0, innerHeight: 500, scrollTo: vi.fn() };
        globalThis.document = { body: { scrollHeight: 1000 } };

        let rafCallback;
        globalThis.requestAnimationFrame = (cb) => { rafCallback = cb; };

        const origSetTimeout = globalThis.setTimeout;
        globalThis.setTimeout = (cb) => { cb(); return 1; };

        const promise = fn();

        // Simulate frames: first at t=250 (midway), then at t=600 (past duration)
        if (rafCallback) {
          startTime = 250;
          const cb1 = rafCallback;
          rafCallback = null;
          cb1();

          // Now simulate past duration (>500ms)
          if (rafCallback) {
            startTime = 600;
            const cb2 = rafCallback;
            rafCallback = null;
            cb2();
          }
        }

        const result = await promise;

        globalThis.window = origWindow;
        globalThis.document = origDocument;
        globalThis.performance = origPerformance;
        globalThis.requestAnimationFrame = origRAF;
        globalThis.setTimeout = origSetTimeout;

        return result;
      });

      await w.renderLazyAnimations();
    });
  });

  describe("close", () => {
    it("should release the pool resource", async () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      await w.initialize();
      await w.close();
      expect(browserPool.release).toHaveBeenCalledWith(mockResource);
      expect(w.poolResource).toBeNull();
      expect(w.browser).toBeNull();
      expect(w.page).toBeNull();
    });

    it("should do nothing if no pool resource", async () => {
      const w = new PuppeteerWrapper({ url: "https://example.com", type: "image" });
      await w.close();
      expect(browserPool.release).not.toHaveBeenCalled();
    });
  });
});
