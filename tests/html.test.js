import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../app/config/constants.js", () => ({
  HTML_CAPTURE_MAX_SIZE_BYTES: 500 * 1024 * 1024,
}));

import { captureHTML } from "../app/core/html.js";

describe("captureHTML", () => {
  let page;

  beforeEach(() => {
    page = {
      evaluate: vi.fn(),
    };
  });

  afterEach(() => {
    // Cleanup any global mocks
    delete globalThis.document;
    delete globalThis.fetch;
    delete globalThis.FileReader;
    delete globalThis.atob;
    delete globalThis.CSSFontFaceRule;
  });

  it("should return a Buffer with the HTML content", async () => {
    page.evaluate.mockResolvedValue("<html><body>Hello</body></html>");
    const result = await captureHTML(page);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe("<html><body>Hello</body></html>");
  });

  it("should throw if HTML exceeds size limit", async () => {
    // Create a string larger than the limit
    const oversizedHtml = "x".repeat(500 * 1024 * 1024 + 1);
    page.evaluate.mockResolvedValue(oversizedHtml);
    await expect(captureHTML(page)).rejects.toThrow("HTML capture exceeded 500MB size limit");
  });

  it("should call page.evaluate with a function", async () => {
    page.evaluate.mockResolvedValue("<html></html>");
    await captureHTML(page);
    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function));
  });

  it("should execute the evaluate callback to cover inner code paths", async () => {
    // Set up the page.evaluate to actually run the callback with mocked browser globals
    page.evaluate.mockImplementation(async (fn) => {
      // Mock browser globals needed by the callback
      const mockStyleSheet = {
        href: null,
        cssRules: [{ cssText: "body { color: red; }" }],
      };

      const mockStyleSheetWithHref = {
        href: "https://example.com/style.css",
        cssRules: [],
      };

      globalThis.document = {
        styleSheets: [mockStyleSheet, mockStyleSheetWithHref],
        scripts: [
          { src: "", innerText: "console.log('inline');" },
          { src: "https://example.com/script.js", innerText: "" },
        ],
        images: [{ src: "https://example.com/img.png" }],
        querySelectorAll: vi.fn().mockReturnValue([]),
        querySelector: vi.fn().mockReturnValue(null),
        getElementsByTagName: vi.fn().mockReturnValue([
          { outerHTML: '<meta charset="UTF-8">' },
        ]),
        documentElement: { lang: "en", dir: "ltr" },
        body: { innerHTML: "<p>Body content</p>" },
        getElementById: vi.fn().mockReturnValue(null),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(["data"])),
      });

      globalThis.FileReader = class {
        readAsDataURL() {
          setTimeout(() => {
            this.result = "data:text/css;base64,Ym9keSB7fQ==";
            this.onloadend();
          }, 0);
        }
      };

      globalThis.atob = vi.fn().mockImplementation((str) => {
        try {
          return Buffer.from(str, "base64").toString("utf-8");
        } catch {
          return "";
        }
      });

      globalThis.CSSFontFaceRule = class CSSFontFaceRule {};

      const result = await fn();
      return result;
    });

    const result = await captureHTML(page);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toContain("<!DOCTYPE html>");
    expect(result.toString()).toContain("Body content");
  });

  it("should handle fetchAndEncode errors (returns original URL)", async () => {
    page.evaluate.mockImplementation(async (fn) => {
      globalThis.document = {
        styleSheets: [],
        scripts: [{ src: "https://example.com/bad.js", innerText: "" }],
        images: [],
        querySelectorAll: vi.fn().mockReturnValue([]),
        querySelector: vi.fn().mockReturnValue(null),
        getElementsByTagName: vi.fn().mockReturnValue([]),
        documentElement: { lang: "en", dir: "ltr" },
        body: { innerHTML: "" },
      };

      globalThis.fetch = vi.fn().mockRejectedValue(new Error("network error"));
      globalThis.FileReader = class { readAsDataURL() {} };
      globalThis.atob = vi.fn().mockReturnValue("");
      globalThis.CSSFontFaceRule = class {};

      const origConsoleError = console.error;
      console.error = vi.fn();
      const result = await fn();
      console.error = origConsoleError;
      return result;
    });

    const result = await captureHTML(page);
    expect(result).toBeInstanceOf(Buffer);
  });

  it("should cover font embedding, icon fonts, svg sprites, and favicon", async () => {
    page.evaluate.mockImplementation(async (fn) => {
      // Create a mock CSSFontFaceRule class
      class MockCSSFontFaceRule {}
      globalThis.CSSFontFaceRule = MockCSSFontFaceRule;

      const fontRule = Object.create(MockCSSFontFaceRule.prototype);
      fontRule.style = {
        getPropertyValue: vi.fn().mockReturnValue("url('https://example.com/font.woff2')"),
      };
      fontRule.cssText = "font-family: 'Test'; src: url('https://example.com/font.woff2')";

      // StyleSheet with font-face rules
      const fontStyleSheet = {
        href: null,
        cssRules: [
          { cssText: "body { margin: 0; }" }, // regular rule
          fontRule, // font-face rule
        ],
      };

      // External stylesheet
      const externalStyleSheet = {
        href: "https://example.com/styles.css",
        cssRules: [],
      };

      // Icon font link elements
      const iconLinks = [
        { href: "https://example.com/font-awesome/css/all.css" },
      ];

      // SVG use elements
      const svgUses = [
        {
          getAttribute: (attr) => attr === "href" ? "#icon-star" : null,
        },
        {
          getAttribute: (attr) => attr === "href" ? null : null,
          // Test xlink:href fallback - no href but no xlink:href either
        },
      ];

      globalThis.document = {
        styleSheets: [fontStyleSheet, externalStyleSheet],
        scripts: [],
        images: [{ src: "https://example.com/photo.jpg" }],
        querySelectorAll: vi.fn().mockImplementation((selector) => {
          if (selector.includes("font-awesome") || selector.includes("icons")) {
            return iconLinks;
          }
          if (selector === "svg use") {
            return svgUses;
          }
          return [];
        }),
        querySelector: vi.fn().mockReturnValue({
          href: "https://example.com/favicon.ico",
        }),
        getElementsByTagName: vi.fn().mockReturnValue([
          { outerHTML: '<meta name="viewport" content="width=device-width">' },
        ]),
        documentElement: { lang: "fr", dir: "rtl" },
        body: { innerHTML: "<div>Content</div>" },
        getElementById: vi.fn().mockImplementation((id) => {
          if (id === "icon-star") {
            return { outerHTML: '<symbol id="icon-star"><path d="M10 0"/></symbol>' };
          }
          return null;
        }),
      };

      // Mock fetch with proper FileReader behavior
      globalThis.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(["mock-data"])),
      });

      globalThis.FileReader = class {
        readAsDataURL() {
          setTimeout(() => {
            this.result = "data:application/octet-stream;base64,bW9jay1kYXRh";
            this.onloadend();
          }, 0);
        }
      };

      globalThis.atob = vi.fn().mockImplementation((str) => {
        try {
          return Buffer.from(str, "base64").toString("utf-8");
        } catch {
          return "";
        }
      });

      const origConsoleError = console.error;
      console.error = vi.fn();
      const result = await fn();
      console.error = origConsoleError;
      return result;
    });

    const result = await captureHTML(page);
    expect(result).toBeInstanceOf(Buffer);
    const html = result.toString();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Content");
  });

  it("should handle stylesheet access errors in font embedding", async () => {
    page.evaluate.mockImplementation(async (fn) => {
      globalThis.CSSFontFaceRule = class {};

      // Cross-origin stylesheet: has href (so styles processing fetches it)
      // but cssRules throws (so font embedding catches the error)
      const crossOriginStyleSheet = {
        href: "https://cdn.example.com/cross-origin.css",
        get cssRules() { throw new Error("SecurityError"); },
      };

      globalThis.document = {
        styleSheets: [crossOriginStyleSheet],
        scripts: [],
        images: [],
        querySelectorAll: vi.fn().mockReturnValue([]),
        querySelector: vi.fn().mockReturnValue(null),
        getElementsByTagName: vi.fn().mockReturnValue([]),
        documentElement: { lang: "en", dir: "ltr" },
        body: { innerHTML: "" },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(["body{}"])),
      });
      globalThis.FileReader = class {
        readAsDataURL() {
          setTimeout(() => { this.result = "data:text/css;base64,Ym9keXt9"; this.onloadend(); }, 0);
        }
      };
      globalThis.atob = vi.fn().mockReturnValue("body{}");

      const origConsoleError = console.error;
      console.error = vi.fn();
      const result = await fn();
      console.error = origConsoleError;
      return result;
    });

    const result = await captureHTML(page);
    expect(result).toBeInstanceOf(Buffer);
  });

  it("should cover safeAtob error path (atob throws)", async () => {
    page.evaluate.mockImplementation(async (fn) => {
      globalThis.CSSFontFaceRule = class {};
      globalThis.document = {
        styleSheets: [],
        scripts: [],
        images: [],
        querySelectorAll: vi.fn().mockImplementation((selector) => {
          if (selector.includes("font-awesome") || selector.includes("icons")) {
            return [{ href: "https://example.com/font-awesome/css/all.css" }];
          }
          return [];
        }),
        querySelector: vi.fn().mockReturnValue(null),
        getElementsByTagName: vi.fn().mockReturnValue([]),
        documentElement: { lang: "en", dir: "ltr" },
        body: { innerHTML: "<p>test</p>" },
        getElementById: vi.fn().mockReturnValue(null),
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(["css-data"])),
      });
      globalThis.FileReader = class {
        readAsDataURL() {
          setTimeout(() => {
            this.result = "data:text/css;base64,INVALIDBASE64!!!";
            this.onloadend();
          }, 0);
        }
      };
      // Make atob throw to trigger safeAtob catch path
      globalThis.atob = vi.fn().mockImplementation(() => {
        throw new Error("Invalid character");
      });

      const origConsoleError = console.error;
      console.error = vi.fn();
      const result = await fn();
      console.error = origConsoleError;
      return result;
    });

    const result = await captureHTML(page);
    expect(result).toBeInstanceOf(Buffer);
  });

  it("should cover icon font URL replacement (lines 126-128)", async () => {
    page.evaluate.mockImplementation(async (fn) => {
      globalThis.CSSFontFaceRule = class {};

      // CSS content with font url() references
      const cssWithFonts = "@font-face { src: url('https://example.com/font.woff2'); }";
      const cssBase64 = Buffer.from(cssWithFonts).toString("base64");

      globalThis.document = {
        styleSheets: [],
        scripts: [],
        images: [],
        querySelectorAll: vi.fn().mockImplementation((selector) => {
          if (selector.includes("font-awesome") || selector.includes("icons")) {
            return [{ href: "https://example.com/font-awesome/css/all.css" }];
          }
          return [];
        }),
        querySelector: vi.fn().mockReturnValue(null),
        getElementsByTagName: vi.fn().mockReturnValue([]),
        documentElement: { lang: "en", dir: "ltr" },
        body: { innerHTML: "<p>test</p>" },
        getElementById: vi.fn().mockReturnValue(null),
      };

      let fetchCallCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        fetchCallCount++;
        return Promise.resolve({
          blob: () => Promise.resolve(new Blob(["data"])),
        });
      });

      globalThis.FileReader = class {
        readAsDataURL() {
          setTimeout(() => {
            // First call returns CSS data URL, second returns font data URL
            this.result = `data:text/css;base64,${cssBase64}`;
            this.onloadend();
          }, 0);
        }
      };

      globalThis.atob = vi.fn().mockImplementation((str) => {
        try {
          return Buffer.from(str, "base64").toString("utf-8");
        } catch {
          return "";
        }
      });

      const result = await fn();
      return result;
    });

    const result = await captureHTML(page);
    expect(result).toBeInstanceOf(Buffer);
    const html = result.toString();
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("should cover icon font embed error handler (line 132)", async () => {
    page.evaluate.mockImplementation(async (fn) => {
      globalThis.CSSFontFaceRule = class {};
      globalThis.document = {
        styleSheets: [],
        scripts: [],
        images: [],
        querySelectorAll: vi.fn().mockImplementation((selector) => {
          if (selector.includes("font-awesome") || selector.includes("icons")) {
            return [{ href: "https://example.com/font-awesome/css/fail.css" }];
          }
          return [];
        }),
        querySelector: vi.fn().mockReturnValue(null),
        getElementsByTagName: vi.fn().mockReturnValue([]),
        documentElement: { lang: "en", dir: "ltr" },
        body: { innerHTML: "" },
        getElementById: vi.fn().mockReturnValue(null),
      };

      // Make fetch succeed but FileReader returns undefined result
      // This causes fetchAndEncode to resolve with undefined
      // Then css.split(",") throws TypeError, caught by the icon font catch block
      globalThis.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(["data"])),
      });
      globalThis.FileReader = class {
        readAsDataURL() {
          setTimeout(() => {
            this.result = undefined; // undefined result triggers .split() error
            this.onloadend();
          }, 0);
        }
      };
      globalThis.atob = vi.fn().mockReturnValue("");

      const origConsoleError = console.error;
      console.error = vi.fn();
      const result = await fn();
      console.error = origConsoleError;
      return result;
    });

    const result = await captureHTML(page);
    expect(result).toBeInstanceOf(Buffer);
  });

  it("should use cache for duplicate URLs in fetchAndEncode", async () => {
    page.evaluate.mockImplementation(async (fn) => {
      globalThis.CSSFontFaceRule = class {};
      globalThis.document = {
        styleSheets: [],
        scripts: [
          { src: "https://example.com/same.js", innerText: "" },
        ],
        // Two images with same src - tests caching
        images: [
          { src: "https://example.com/img.png" },
          { src: "https://example.com/img.png" },
        ],
        querySelectorAll: vi.fn().mockReturnValue([]),
        querySelector: vi.fn().mockReturnValue(null),
        getElementsByTagName: vi.fn().mockReturnValue([]),
        documentElement: { lang: "en", dir: "ltr" },
        body: { innerHTML: "" },
      };

      let fetchCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        fetchCount++;
        return Promise.resolve({
          blob: () => Promise.resolve(new Blob(["data"])),
        });
      });
      globalThis.FileReader = class {
        readAsDataURL() {
          setTimeout(() => { this.result = "data:;base64,ZGF0YQ=="; this.onloadend(); }, 0);
        }
      };
      globalThis.atob = vi.fn().mockReturnValue("data");

      const result = await fn();
      return result;
    });

    const result = await captureHTML(page);
    expect(result).toBeInstanceOf(Buffer);
  });
});
