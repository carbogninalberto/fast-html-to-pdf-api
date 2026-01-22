import { PassThrough } from "stream";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";
import { VIDEO_MAX_SCROLL_DURATION_MS } from "../config/constants.js";
import logger from "../utils/logger.js";

export async function captureVideo(page, config) {
  const videoConfig = {
    ...config.video,
    ffmpeg_Path: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg'
  };
  const recorder = new PuppeteerScreenRecorder(page, videoConfig);

  try {
    const stream = new PassThrough();
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));

    await recorder.startStream(stream);

    if (config.render.scroll.animate) {
      await performAutoScroll(page, config.render.scroll.duration);
    } else {
      await new Promise((resolve) =>
        setTimeout(resolve, config.render.scroll.duration)
      );
    }

    await recorder.stop();

    return Buffer.concat(chunks);
  } catch (error) {
    logger.error({ err: error }, "video: error during capture");
    throw error;
  }
}

async function performAutoScroll(page, duration = 5000) {
  duration = Math.min(duration, VIDEO_MAX_SCROLL_DURATION_MS);
  const startTime = Date.now();
  while (Date.now() - startTime < duration) {
    await page
      .evaluate((duration) => {
        return new Promise((resolve) => {
          const totalHeight = document.body.scrollHeight - window.innerHeight;
          const startTime = Date.now();
          const scrollInterval = 16; // Use 60 FPS for smooth animation

          const easeInOutQuad = (t) =>
            t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

          const timer = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            const progress = Math.min(elapsedTime / duration, 1);

            if (progress >= 1) {
              clearInterval(timer);
              window.scrollTo(0, totalHeight);
              resolve(true);
              return;
            }

            const easedProgress = easeInOutQuad(progress);
            const targetScroll = totalHeight * easedProgress;

            window.scrollTo(0, targetScroll);

            if (
              window.innerHeight + window.scrollY >=
              document.body.offsetHeight
            ) {
              clearInterval(timer);
              resolve(true);
            }
          }, scrollInterval);
        });
      }, duration)
      .then((isEndOfPage) => {
        if (isEndOfPage) return;
      });
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
