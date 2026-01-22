import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSharpInstance = {
  metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
  extract: vi.fn(),
  rotate: vi.fn(),
  resize: vi.fn(),
  composite: vi.fn(),
  extend: vi.fn(),
  jpeg: vi.fn(),
  png: vi.fn(),
  webp: vi.fn(),
  avif: vi.fn(),
  gif: vi.fn(),
  toBuffer: vi.fn().mockResolvedValue(Buffer.from("output")),
};

// Each chainable method returns the instance
for (const method of ['extract', 'rotate', 'resize', 'composite', 'extend', 'jpeg', 'png', 'webp', 'avif', 'gif']) {
  mockSharpInstance[method].mockReturnValue(mockSharpInstance);
}

vi.mock("sharp", () => {
  const sharpFn = vi.fn();
  return { default: sharpFn };
});

import sharp from "sharp";
import { captureImage } from "../app/core/image.js";

describe("captureImage", () => {
  let page;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chainable mocks each time
    for (const method of ['extract', 'rotate', 'resize', 'composite', 'extend', 'jpeg', 'png', 'webp', 'avif', 'gif']) {
      mockSharpInstance[method].mockReturnValue(mockSharpInstance);
    }
    mockSharpInstance.metadata.mockResolvedValue({ width: 1920, height: 1080 });
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from("output"));
    sharp.mockReturnValue(mockSharpInstance);

    page = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from("screenshot-data")),
    };
  });

  it("should take a screenshot and return buffer", async () => {
    const result = await captureImage(page, { image: { type: "png" }, render: {} });
    expect(page.screenshot).toHaveBeenCalled();
    expect(result).toBeInstanceOf(Buffer);
  });

  it("should pass fullPage option to screenshot", async () => {
    await captureImage(page, { image: { type: "png" }, render: { fullPage: true } });
    expect(page.screenshot).toHaveBeenCalledWith({ fullPage: true });
  });

  describe("crop", () => {
    it("should apply crop when specified", async () => {
      await captureImage(page, {
        image: { type: "png", crop: { x: 10, y: 20, width: 100, height: 200 } },
        render: {},
      });
      expect(mockSharpInstance.extract).toHaveBeenCalledWith({
        left: 10, top: 20, width: 100, height: 200,
      });
    });

    it("should default x and y to 0", async () => {
      await captureImage(page, {
        image: { type: "png", crop: { width: 100, height: 200 } },
        render: {},
      });
      expect(mockSharpInstance.extract).toHaveBeenCalledWith({
        left: 0, top: 0, width: 100, height: 200,
      });
    });

    it("should clamp crop width to image width if too large", async () => {
      await captureImage(page, {
        image: { type: "png", crop: { x: 0, y: 0, width: 5000, height: 200 } },
        render: {},
      });
      expect(mockSharpInstance.extract).toHaveBeenCalledWith(
        expect.objectContaining({ width: 1920 })
      );
    });

    it("should clamp crop height to image height if too large", async () => {
      await captureImage(page, {
        image: { type: "png", crop: { x: 0, y: 0, width: 100, height: 5000 } },
        render: {},
      });
      expect(mockSharpInstance.extract).toHaveBeenCalledWith(
        expect.objectContaining({ height: 1080 })
      );
    });

    it("should use currentWidth if width is 0/falsy", async () => {
      await captureImage(page, {
        image: { type: "png", crop: { x: 0, y: 0, width: 0, height: 100 } },
        render: {},
      });
      expect(mockSharpInstance.extract).toHaveBeenCalledWith(
        expect.objectContaining({ width: 1920 })
      );
    });
  });

  describe("rotate", () => {
    it("should apply rotation when non-zero", async () => {
      await captureImage(page, { image: { type: "png", rotate: 45 }, render: {} });
      expect(mockSharpInstance.rotate).toHaveBeenCalledWith(45);
    });

    it("should not rotate when 0", async () => {
      await captureImage(page, { image: { type: "png", rotate: 0 }, render: {} });
      expect(mockSharpInstance.rotate).not.toHaveBeenCalled();
    });

    it("should not rotate when not a number", async () => {
      await captureImage(page, { image: { type: "png", rotate: "abc" }, render: {} });
      expect(mockSharpInstance.rotate).not.toHaveBeenCalled();
    });
  });

  describe("resize", () => {
    it("should apply resize when not 1", async () => {
      await captureImage(page, { image: { type: "png", resize: 2 }, render: {} });
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(3840, 2160, expect.any(Object));
    });

    it("should clamp resize to min 0.1", async () => {
      await captureImage(page, { image: { type: "png", resize: 0.01 }, render: {} });
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(
        Math.round(1920 * 0.1), Math.round(1080 * 0.1), expect.any(Object)
      );
    });

    it("should clamp resize to max 3", async () => {
      await captureImage(page, { image: { type: "png", resize: 10 }, render: {} });
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(
        Math.round(1920 * 3), Math.round(1080 * 3), expect.any(Object)
      );
    });

    it("should not resize when 1", async () => {
      await captureImage(page, { image: { type: "png", resize: 1 }, render: {} });
      expect(mockSharpInstance.resize).not.toHaveBeenCalled();
    });

    it("should not resize when not a number", async () => {
      await captureImage(page, { image: { type: "png", resize: "big" }, render: {} });
      expect(mockSharpInstance.resize).not.toHaveBeenCalled();
    });
  });

  describe("roundedBorders", () => {
    it("should apply rounded borders with numeric value", async () => {
      await captureImage(page, { image: { type: "png", roundedBorders: 30 }, render: {} });
      expect(mockSharpInstance.composite).toHaveBeenCalled();
    });

    it("should use default radius 20 for non-numeric truthy value", async () => {
      await captureImage(page, { image: { type: "png", roundedBorders: true }, render: {} });
      expect(mockSharpInstance.composite).toHaveBeenCalled();
    });

    it("should not apply when 0", async () => {
      await captureImage(page, { image: { type: "png", roundedBorders: 0 }, render: {} });
      expect(mockSharpInstance.composite).not.toHaveBeenCalled();
    });
  });

  describe("padding", () => {
    it("should apply padding with numeric value", async () => {
      await captureImage(page, { image: { type: "png", padding: 10 }, render: {} });
      expect(mockSharpInstance.extend).toHaveBeenCalledWith({
        top: 10, bottom: 10, left: 10, right: 10,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    });

    it("should use default 20 for non-numeric truthy value", async () => {
      await captureImage(page, { image: { type: "png", padding: true }, render: {} });
      expect(mockSharpInstance.extend).toHaveBeenCalledWith(
        expect.objectContaining({ top: 20 })
      );
    });

    it("should not apply when 0", async () => {
      await captureImage(page, { image: { type: "png", padding: 0 }, render: {} });
      expect(mockSharpInstance.extend).not.toHaveBeenCalled();
    });
  });

  describe("output formats", () => {
    it("should output jpeg with quality and mozjpeg", async () => {
      await captureImage(page, { image: { type: "jpeg", quality: 90 }, render: {} });
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith(expect.objectContaining({ quality: 90, mozjpeg: true }));
    });

    it("should output png with compression and smooth options", async () => {
      await captureImage(page, { image: { type: "png", compression: 6, smooth: true, quality: 100 }, render: {} });
      expect(mockSharpInstance.png).toHaveBeenCalledWith(expect.objectContaining({
        compressionLevel: 6,
        adaptiveFiltering: true,
        palette: true,
      }));
    });

    it("should handle numeric compression 3 for png", async () => {
      await captureImage(page, { image: { type: "png", compression: 3 }, render: {} });
      expect(mockSharpInstance.png).toHaveBeenCalledWith(expect.objectContaining({ compressionLevel: 3 }));
    });

    it("should not set compressionLevel when compression is 0", async () => {
      await captureImage(page, { image: { type: "png", compression: 0 }, render: {} });
      const pngCall = mockSharpInstance.png.mock.calls[0][0];
      expect(pngCall.compressionLevel).toBeUndefined();
    });

    it("should handle non-string/number compression (defaults to 9)", async () => {
      await captureImage(page, { image: { type: "png", compression: true }, render: {} });
      expect(mockSharpInstance.png).toHaveBeenCalledWith(expect.objectContaining({ compressionLevel: 9 }));
    });

    it("should output webp with quality", async () => {
      await captureImage(page, { image: { type: "webp", quality: 70 }, render: {} });
      expect(mockSharpInstance.webp).toHaveBeenCalledWith(expect.objectContaining({ quality: 70, effort: 4 }));
    });

    it("should output avif with quality", async () => {
      await captureImage(page, { image: { type: "avif", quality: 40 }, render: {} });
      expect(mockSharpInstance.avif).toHaveBeenCalledWith(expect.objectContaining({ quality: 40, speed: 5 }));
    });

    it("should output gif", async () => {
      await captureImage(page, { image: { type: "gif" }, render: {} });
      expect(mockSharpInstance.gif).toHaveBeenCalledWith(expect.objectContaining({ effort: 7, dither: 1.0 }));
    });

    it("should default to png for unknown type", async () => {
      await captureImage(page, { image: { type: "bmp" }, render: {} });
      expect(mockSharpInstance.png).toHaveBeenCalled();
    });

    it("should use default jpeg quality 80 when not specified", async () => {
      await captureImage(page, { image: { type: "jpeg" }, render: {} });
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith(expect.objectContaining({ quality: 80 }));
    });

    it("should use default webp quality 80 when not specified", async () => {
      await captureImage(page, { image: { type: "webp" }, render: {} });
      expect(mockSharpInstance.webp).toHaveBeenCalledWith(expect.objectContaining({ quality: 80 }));
    });

    it("should use default avif quality 50 when not specified", async () => {
      await captureImage(page, { image: { type: "avif" }, render: {} });
      expect(mockSharpInstance.avif).toHaveBeenCalledWith(expect.objectContaining({ quality: 50 }));
    });
  });
});
