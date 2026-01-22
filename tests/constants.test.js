import { describe, it, expect } from "vitest";
import {
  SERVER_PORT, BODY_LIMIT_BYTES, SHUTDOWN_TIMEOUT_MS,
  POOL_MIN, POOL_MAX, POOL_ACQUIRE_TIMEOUT_MS,
  BROWSER_MAX_RETRIES, BROWSER_MAX_REQUESTS, BROWSER_MAX_MEMORY_MB,
  DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT,
  IMAGE_RESIZE_MIN, IMAGE_RESIZE_MAX,
  VIDEO_MAX_SCROLL_DURATION_MS,
  HTML_CAPTURE_MAX_SIZE_BYTES,
} from "../app/config/constants.js";

describe("constants", () => {
  it("should have correct default server port", () => {
    expect(SERVER_PORT).toBe(3000);
  });

  it("should have 50MB body limit", () => {
    expect(BODY_LIMIT_BYTES).toBe(50 * 1024 * 1024);
  });

  it("should have 30s shutdown timeout", () => {
    expect(SHUTDOWN_TIMEOUT_MS).toBe(30000);
  });

  it("should have valid pool min/max defaults", () => {
    expect(POOL_MIN).toBe(2);
    expect(POOL_MAX).toBe(10);
    expect(POOL_MAX).toBeGreaterThan(POOL_MIN);
  });

  it("should have reasonable acquire timeout", () => {
    expect(POOL_ACQUIRE_TIMEOUT_MS).toBeGreaterThanOrEqual(10000);
  });

  it("should have browser recycling thresholds", () => {
    expect(BROWSER_MAX_RETRIES).toBeGreaterThan(0);
    expect(BROWSER_MAX_REQUESTS).toBeGreaterThan(0);
    expect(BROWSER_MAX_MEMORY_MB).toBeGreaterThan(0);
  });

  it("should have standard viewport defaults", () => {
    expect(DEFAULT_VIEWPORT_WIDTH).toBe(1920);
    expect(DEFAULT_VIEWPORT_HEIGHT).toBe(1080);
  });

  it("should have valid image resize bounds", () => {
    expect(IMAGE_RESIZE_MIN).toBeLessThan(1);
    expect(IMAGE_RESIZE_MAX).toBeGreaterThan(1);
  });

  it("should have video scroll duration cap", () => {
    expect(VIDEO_MAX_SCROLL_DURATION_MS).toBe(20000);
  });

  it("should have 500MB html capture limit", () => {
    expect(HTML_CAPTURE_MAX_SIZE_BYTES).toBe(500 * 1024 * 1024);
  });
});
