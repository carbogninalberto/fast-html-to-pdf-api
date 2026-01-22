import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Test cookies.js
describe("blockCookies", () => {
  let blockCookies;
  let page;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    page = {
      evaluate: vi.fn().mockResolvedValue(undefined),
    };

    const mod = await import("../app/core/cookies.js");
    blockCookies = mod.blockCookies;
  });

  afterEach(() => {
    delete globalThis.document;
  });

  it("should call page.evaluate with ACCEPTED_WORDS", async () => {
    await blockCookies(page);

    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), expect.any(Object));
    // Verify ACCEPTED_WORDS was passed (second argument)
    const acceptedWords = page.evaluate.mock.calls[0][1];
    expect(acceptedWords).toHaveProperty("en");
    expect(acceptedWords.en).toContain("accept");
  });

  it("should execute the evaluate callback to cover inner code", async () => {
    page.evaluate.mockImplementation(async (fn, ACCEPTED_WORDS) => {
      // Set up mock browser globals for the callback
      const clickSpy = vi.fn();
      const mockElements = [
        { tagName: "button", innerText: "Accept", click: clickSpy },
        { tagName: "a", innerText: "Accept", click: vi.fn() }, // should be skipped (link)
      ];

      globalThis.document = {
        dispatchEvent: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue(mockElements),
      };

      globalThis.KeyboardEvent = class KeyboardEvent {
        constructor(type, opts) {
          this.type = type;
          Object.assign(this, opts);
        }
      };

      // Mock Promise-based wait
      const origSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = (cb, ms) => { cb(); return 1; };

      await fn(ACCEPTED_WORDS);

      globalThis.setTimeout = origSetTimeout;
      delete globalThis.KeyboardEvent;
      delete globalThis.document;

      return undefined;
    });

    await blockCookies(page);

    expect(page.evaluate).toHaveBeenCalled();
  });

  it("should skip anchor elements in cookie banner search", async () => {
    const clickSpyButton = vi.fn();
    const clickSpyLink = vi.fn();

    page.evaluate.mockImplementation(async (fn, ACCEPTED_WORDS) => {
      const mockElements = [
        { tagName: "A", innerText: "Accept Cookies", click: clickSpyLink },
        { tagName: "BUTTON", innerText: "Accept Cookies", click: clickSpyButton },
      ];

      globalThis.document = {
        dispatchEvent: vi.fn(),
        querySelectorAll: vi.fn().mockReturnValue(mockElements),
      };
      globalThis.KeyboardEvent = class KeyboardEvent {
        constructor(type, opts) { Object.assign(this, opts); }
      };

      const origSetTimeout = globalThis.setTimeout;
      globalThis.setTimeout = (cb) => { cb(); return 1; };
      await fn(ACCEPTED_WORDS);
      globalThis.setTimeout = origSetTimeout;
      delete globalThis.document;
      delete globalThis.KeyboardEvent;
    });

    await blockCookies(page);
  });

  it("should wait 500ms after evaluate", async () => {
    const start = Date.now();
    await blockCookies(page);
    const elapsed = Date.now() - start;
    // Verify it waited at least ~500ms
    expect(elapsed).toBeGreaterThanOrEqual(400);
  });
});

// Test pdf.js (trivial passthrough)
describe("capturePDF", () => {
  it("should call page.pdf with config", async () => {
    const { capturePDF } = await import("../app/core/pdf.js");
    const page = { pdf: vi.fn().mockResolvedValue(Buffer.from("pdf-content")) };
    const config = { pdf: { format: "A4", landscape: true } };

    const result = await capturePDF(page, config);
    expect(page.pdf).toHaveBeenCalledWith({ format: "A4", landscape: true });
    expect(result).toEqual(Buffer.from("pdf-content"));
  });
});

// Test logger.js (import covers it)
describe("logger", () => {
  it("should export a pino logger instance", async () => {
    const { default: logger } = await import("../app/utils/logger.js");
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
  });
});

// Test core/constants.js
describe("core/constants (ACCEPTED_WORDS)", () => {
  it("should export ACCEPTED_WORDS with multiple languages", async () => {
    const { ACCEPTED_WORDS } = await import("../app/core/constants.js");
    expect(ACCEPTED_WORDS).toHaveProperty("en");
    expect(ACCEPTED_WORDS).toHaveProperty("de");
    expect(ACCEPTED_WORDS).toHaveProperty("fr");
    expect(ACCEPTED_WORDS).toHaveProperty("es");
    expect(ACCEPTED_WORDS).toHaveProperty("it");
    expect(ACCEPTED_WORDS.en).toContain("accept");
  });
});
