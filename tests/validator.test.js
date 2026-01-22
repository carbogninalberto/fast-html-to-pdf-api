import { describe, it, expect } from "vitest";
import { validateConfig } from "../app/utils/validator.js";

describe("validateConfig", () => {
  it("should accept valid image config with url", () => {
    const result = validateConfig({
      url: "https://example.com",
      type: "image",
    });
    expect(result.error).toBe(false);
  });

  it("should accept valid config with html content", () => {
    const result = validateConfig({
      html: "<h1>Hello</h1>",
      type: "pdf",
    });
    expect(result.error).toBe(false);
  });

  it("should reject config without url or html", () => {
    const result = validateConfig({
      type: "image",
    });
    expect(result.error).toBe(true);
  });

  it("should reject invalid type", () => {
    const result = validateConfig({
      url: "https://example.com",
      type: "invalid",
    });
    expect(result.error).toBe(true);
  });

  it("should reject invalid locale format", () => {
    const result = validateConfig({
      url: "https://example.com",
      type: "image",
      device: { locale: "invalid-locale-format!!" },
    });
    expect(result.error).toBe(true);
  });

  it("should accept valid locale formats", () => {
    const validLocales = ["en", "en-US", "fr-FR", "zh-CN", "pt-BR"];
    for (const locale of validLocales) {
      const result = validateConfig({
        url: "https://example.com",
        type: "image",
        device: { locale },
      });
      expect(result.error, `locale ${locale} should be valid`).toBe(false);
    }
  });

  it("should accept valid video config", () => {
    const result = validateConfig({
      url: "https://example.com",
      type: "video",
      video: {
        fps: 30,
        videoCrf: 23,
        videoCodec: "libx264",
        videoPreset: "fast",
        videoBitrate: 3000,
        recordDurationLimit: 10,
      },
    });
    expect(result.error).toBe(false);
  });

  it("should reject video bitrate out of range", () => {
    const result = validateConfig({
      url: "https://example.com",
      type: "video",
      video: { videoBitrate: 99999 },
    });
    expect(result.error).toBe(true);
  });

  it("should accept valid pdf config", () => {
    const result = validateConfig({
      url: "https://example.com",
      type: "pdf",
      pdf: {
        format: "A4",
        landscape: true,
        printBackground: true,
        margin: { top: "10px", right: "10px", bottom: "10px", left: "10px" },
      },
    });
    expect(result.error).toBe(false);
  });

  it("should accept valid image processing options", () => {
    const result = validateConfig({
      url: "https://example.com",
      type: "image",
      image: {
        type: "webp",
        quality: 80,
        resize: 2,
        rotate: 90,
        compression: 6,
      },
    });
    expect(result.error).toBe(false);
  });

  it("should reject image resize out of range", () => {
    const result = validateConfig({
      url: "https://example.com",
      type: "image",
      image: { resize: 5 },
    });
    expect(result.error).toBe(true);
  });

  it("should accept render options", () => {
    const result = validateConfig({
      url: "https://example.com",
      type: "image",
      render: {
        waitTime: 1000,
        fullPage: true,
        waitUntil: "networkidle2",
        scroll: { animate: true, duration: 3000 },
      },
    });
    expect(result.error).toBe(false);
  });

  it("should reject invalid waitUntil value", () => {
    const result = validateConfig({
      url: "https://example.com",
      type: "image",
      render: { waitUntil: "invalid" },
    });
    expect(result.error).toBe(true);
  });
});
