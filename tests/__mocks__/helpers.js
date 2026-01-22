import { vi } from "vitest";

/**
 * Creates a mock Puppeteer page with common methods.
 */
export function createMockPage(overrides = {}) {
  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    setContent: vi.fn().mockResolvedValue(undefined),
    setViewport: vi.fn().mockResolvedValue(undefined),
    setUserAgent: vi.fn().mockResolvedValue(undefined),
    setJavaScriptEnabled: vi.fn().mockResolvedValue(undefined),
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
    emulateTimezone: vi.fn().mockResolvedValue(undefined),
    setDefaultNavigationTimeout: vi.fn().mockResolvedValue(undefined),
    setDefaultTimeout: vi.fn().mockResolvedValue(undefined),
    setCacheEnabled: vi.fn().mockResolvedValue(undefined),
    setRequestInterception: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("fake-png")),
    pdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
    evaluate: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isClosed: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    ...overrides,
  };
  return page;
}

/**
 * Creates a mock Puppeteer browser.
 */
export function createMockBrowser(overrides = {}) {
  const browser = {
    newPage: vi.fn().mockResolvedValue(createMockPage()),
    close: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    process: vi.fn().mockReturnValue({ pid: 1234 }),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    _poolCreatedAt: Date.now(),
    _requestCount: 0,
    ...overrides,
  };
  return browser;
}

/**
 * Creates a mock pool resource {browser, page, createdAt}.
 */
export function createMockResource(overrides = {}) {
  const page = createMockPage();
  const browser = createMockBrowser({ newPage: vi.fn().mockResolvedValue(page) });
  return {
    browser,
    page,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Creates a mock generic-pool instance.
 */
export function createMockPool(overrides = {}) {
  const resource = createMockResource();
  return {
    acquire: vi.fn().mockResolvedValue(resource),
    release: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    drain: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    size: 2,
    available: 1,
    borrowed: 1,
    pending: 0,
    max: 5,
    min: 1,
    ...overrides,
  };
}

/**
 * Creates a mock sharp instance with chainable methods.
 */
export function createMockSharp() {
  const instance = {
    metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
    extract: vi.fn().mockReturnThis(),
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    extend: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    avif: vi.fn().mockReturnThis(),
    gif: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("output-image")),
  };
  return instance;
}

/**
 * Creates a mock Fastify reply.
 */
export function createMockReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
  };
  return reply;
}

/**
 * Creates a mock Fastify request.
 */
export function createMockRequest(overrides = {}) {
  return {
    method: "POST",
    body: { url: "https://example.com", type: "image" },
    query: {},
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    ...overrides,
  };
}
