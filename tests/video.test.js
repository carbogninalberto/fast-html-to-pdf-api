import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRecorder = {
  startStream: vi.fn(),
  stop: vi.fn().mockResolvedValue(undefined),
};

vi.mock("puppeteer-screen-recorder", () => ({
  PuppeteerScreenRecorder: class {
    constructor(page, config) {
      mockRecorder._page = page;
      mockRecorder._config = config;
      return mockRecorder;
    }
  },
}));

vi.mock("../app/utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../app/config/constants.js", () => ({
  VIDEO_MAX_SCROLL_DURATION_MS: 20000,
}));

import { captureVideo } from "../app/core/video.js";

describe("captureVideo", () => {
  let page;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRecorder.startStream.mockImplementation((stream) => {
      stream.write(Buffer.from("video-chunk-1"));
      stream.write(Buffer.from("video-chunk-2"));
      return Promise.resolve();
    });
    mockRecorder.stop.mockResolvedValue(undefined);

    page = {
      evaluate: vi.fn().mockResolvedValue(true),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should record video without scroll animation", async () => {
    vi.useFakeTimers();
    const config = {
      video: { fps: 30 },
      render: { scroll: { animate: false, duration: 100 } },
    };

    const promise = captureVideo(page, config);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toBeInstanceOf(Buffer);
    expect(mockRecorder.startStream).toHaveBeenCalled();
    expect(mockRecorder.stop).toHaveBeenCalled();
  });

  it("should record video with scroll animation", async () => {
    const config = {
      video: { fps: 30 },
      render: { scroll: { animate: true, duration: 50 } },
    };

    page.evaluate.mockResolvedValue(true);

    const result = await captureVideo(page, config);
    expect(result).toBeInstanceOf(Buffer);
    expect(page.evaluate).toHaveBeenCalled();
  });

  it("should throw and log error on recorder failure", async () => {
    mockRecorder.startStream.mockRejectedValue(new Error("recorder failed"));
    const config = {
      video: { fps: 30 },
      render: { scroll: { animate: false, duration: 100 } },
    };

    await expect(captureVideo(page, config)).rejects.toThrow("recorder failed");
  });

  it("should use FFMPEG_PATH from env", async () => {
    process.env.FFMPEG_PATH = "/custom/ffmpeg";
    vi.useFakeTimers();
    const config = {
      video: { fps: 60 },
      render: { scroll: { animate: false, duration: 50 } },
    };

    const promise = captureVideo(page, config);
    await vi.advanceTimersByTimeAsync(50);
    await promise;

    expect(mockRecorder._config.ffmpeg_Path).toBe("/custom/ffmpeg");
    delete process.env.FFMPEG_PATH;
  });

  it("should execute the page.evaluate scroll callback (complete)", async () => {
    const config = {
      video: { fps: 30 },
      render: { scroll: { animate: true, duration: 50 } },
    };

    let evaluateCallCount = 0;
    page.evaluate.mockImplementation(async (fn, duration) => {
      evaluateCallCount++;
      if (evaluateCallCount <= 1) {
        const origDoc = globalThis.document;
        const origWin = globalThis.window;
        const origSetInterval = globalThis.setInterval;
        const origClearInterval = globalThis.clearInterval;
        const origDateNow = Date.now;

        globalThis.document = { body: { scrollHeight: 2000, offsetHeight: 2000 } };
        globalThis.window = { innerHeight: 500, scrollY: 1500, scrollTo: vi.fn() };

        let intervalCb;
        globalThis.setInterval = (cb) => { intervalCb = cb; return 1; };
        globalThis.clearInterval = vi.fn();

        const promiseResult = fn(duration);

        // Simulate progress >= 1 (complete)
        if (intervalCb) {
          const startTs = origDateNow();
          Date.now = () => startTs + duration + 100;
          intervalCb();
          Date.now = origDateNow;
        }

        const result = await promiseResult;

        globalThis.document = origDoc;
        globalThis.window = origWin;
        globalThis.setInterval = origSetInterval;
        globalThis.clearInterval = origClearInterval;

        return result;
      }
      return true;
    });

    const result = await captureVideo(page, config);
    expect(result).toBeInstanceOf(Buffer);
  });

  it("should execute the scroll callback with intermediate progress", async () => {
    const config = {
      video: { fps: 30 },
      render: { scroll: { animate: true, duration: 100 } },
    };

    let evaluateCallCount = 0;
    page.evaluate.mockImplementation(async (fn, duration) => {
      evaluateCallCount++;
      if (evaluateCallCount <= 1) {
        const origDoc = globalThis.document;
        const origWin = globalThis.window;
        const origSetInterval = globalThis.setInterval;
        const origClearInterval = globalThis.clearInterval;
        const origDateNow = Date.now;

        // Set up so that scrollY + innerHeight >= offsetHeight triggers early exit
        globalThis.document = { body: { scrollHeight: 1000, offsetHeight: 1000 } };
        globalThis.window = { innerHeight: 500, scrollY: 0, scrollTo: vi.fn() };

        let intervalCb;
        globalThis.setInterval = (cb) => { intervalCb = cb; return 1; };
        globalThis.clearInterval = vi.fn();

        const promiseResult = fn(duration);

        // First call: progress < 1 (t < 0.5 path of easeInOutQuad)
        if (intervalCb) {
          const startTs = origDateNow();
          Date.now = () => startTs + 30; // 30% progress
          globalThis.window.scrollY = 100;
          intervalCb();

          // Second call: progress < 1 (t > 0.5 path of easeInOutQuad)
          Date.now = () => startTs + 70; // 70% progress
          globalThis.window.scrollY = 400;
          intervalCb();

          // Third call: reached bottom of page
          Date.now = () => startTs + 80;
          globalThis.window.scrollY = 500; // scrollY + innerHeight >= offsetHeight
          intervalCb();
          Date.now = origDateNow;
        }

        const result = await promiseResult;

        globalThis.document = origDoc;
        globalThis.window = origWin;
        globalThis.setInterval = origSetInterval;
        globalThis.clearInterval = origClearInterval;

        return result;
      }
      return true;
    });

    const result = await captureVideo(page, config);
    expect(result).toBeInstanceOf(Buffer);
  });
});
