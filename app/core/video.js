import fs from "fs/promises";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";

export async function captureVideo(page, config) {
  const videoConfig = {
    ...config.video,
    ffmpeg_Path: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg'
  };
  const recorder = new PuppeteerScreenRecorder(page, videoConfig);

  try {
    // Generate a random filename
    const randomFileName = `video_${Math.random()
      .toString(36)
      .substring(7)}.mp4`;
    // assure ./screenshots/video/ exists
    await fs.mkdir("./screenshots/video", { recursive: true });
    const videoPath = `./screenshots/video/${randomFileName}`;

    // Start the recording with the temporary file
    await recorder.start(videoPath);

    if (config.render.scroll.animate) {
      await performAutoScroll(page, config.render.scroll.duration);
    } else {
      await new Promise((resolve) =>
        setTimeout(resolve, config.render.scroll.duration)
      );
    }

    await recorder.stop();

    // Read the video file
    const videoBuffer = await fs.readFile(videoPath);

    // Schedule file deletion after 10 seconds
    setTimeout(async () => {
      try {
        await fs.unlink(videoPath);
      } catch (error) {
        console.error(
          `Error deleting temporary video file ${videoPath}:`,
          error
        );
      }
    }, 10000);

    return videoBuffer;
  } catch (error) {
    console.error("Error during video capture:", error);
    throw error;
  }
}

async function performAutoScroll(page, duration = 5000) {
  // cap the scroll duration to 20 seconds
  duration = Math.min(duration, 20000);
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
