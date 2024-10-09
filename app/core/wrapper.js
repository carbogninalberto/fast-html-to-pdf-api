import puppeteer from "puppeteer";
import { captureImage } from "./image.js";
import { capturePDF } from "./pdf.js";
import { captureVideo } from "./video.js";
import { captureHTML } from "./html.js";
import { blockCookies } from "./cookies.js";
import { validateConfig } from "../utils/validator.js";

/**
 * Configuration for the page setup.
 * @typedef {Object} PageConfig
 * @property {number} width - The width of the viewport.
 * @property {number} height - The height of the viewport.
 * @property {string} url - The URL of the page to capture.
 * @property {number} [renderWaitTime] - Optional. Time to wait after page load before capturing.
 * @property {boolean} [renderScrollAnimations] - Optional. Whether to render scroll animations.
 * @property {string} [userAgent] - Optional. The user agent string to use.
 * @property {number} [deviceScaleFactor] - Optional. The device scale factor.
 * @property {string} [locale] - Optional. The locale to use.
 * @property {string} [waitUntil] - Optional. Puppeteer's waitUntil option.
 */

/**
 * Configuration for the capture process.
 * @typedef {Object} CaptureConfig
 * @property {('image'|'pdf'|'video')} type - The type of capture to perform.
 * @property {number} [scrollDuration] - Optional. Duration of scroll animation in milliseconds.
 * @property {boolean} [autoScroll] - Optional. Whether to automatically scroll the page.
 * @property {boolean} [fullPage] - Optional. Whether to capture the full page.
 * @property {boolean} [removeCookieBanners] - Optional. Whether to remove cookie banners before capture.
 */

/**
 * Configuration for video capture.
 * @typedef {Object} VideoConfig
 * @property {number} [fps] - Optional. Frames per second for the video.
 * @property {Object} [videoFrame] - Optional. Video frame dimensions.
 * @property {number} [videoCrf] - Optional. Constant Rate Factor for video compression.
 * @property {string} [videoCodec] - Optional. Video codec to use.
 * @property {string} [videoPreset] - Optional. Video encoding preset.
 * @property {number} [videoBitrate] - Optional. Video bitrate in kbps.
 */

export class PuppeteerWrapper {
  constructor(config) {
    console.log("config", config);
    this.browser = null;
    this.page = null;
    this.recorder = null;

    // generation config
    this.url = config?.url ?? "";
    this.type = config?.type ?? "image";

    // custom headers
    this.headers = config?.headers ?? {};

    // render options
    this.render = {
      block: {
        cookies: config?.render?.block?.cookies ?? false,
        ads: config?.render?.block?.ads ?? false,
        trackers: config?.render?.block?.trackers ?? false,
        banners: config?.render?.block?.banners ?? false,
      },
      // render wait time: time to wait after page load before capturing
      waitTime: config?.render?.waitTime ?? 0,
      // render timeout: time to wait before capturing the page
      timeout: config?.render?.timeout ?? 30000,
      fullPage: config?.render?.fullPage ?? false,
      triggerLazyAnimations: config?.render?.triggerLazyAnimations ?? false,
      // scroll config
      scroll: {
        // scroll position of the page in px
        position: config?.render?.scroll?.position ?? 0,
        // auto scroll the page
        animate: config?.render?.scroll?.animate ?? false,
        duration: config?.render?.scroll?.duration ?? 5000,
        animation: config?.render?.scroll?.animation ?? "smooth",
      },
      // puppeteer's waitUntil: networkidle0, domcontentloaded, load, networkidle2
      waitUntil: config?.render?.waitUntil ?? "networkidle0",
    };

    // device config
    this.device = {
      // user agent of the device
      userAgent:
        config?.device?.userAgent ??
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      // device scale factor
      scale: config?.device?.scale ?? 1,
      // viewport width & height
      width: config?.device?.width ?? 1920,
      height: config?.device?.height ?? 1080,
      // locale header
      locale: config?.device?.locale ?? "en-US",
      // timezone header
      timezone: config?.device?.timezone ?? "UTC",
      // javascript enabled
      javascriptEnabled: config?.device?.javascriptEnabled ?? true,
      // cache settings: TTL & cache key
      cache: config?.device?.cache ?? false,
      // cache key
      cacheKey: config?.device?.cacheKey ?? "",
    };

    // specific configs for video, pdf, etc.
    this.image = config?.image ?? {};
    this.video = config?.video ?? {};
    this.pdf = config?.pdf ?? {};

    // default image config
    this.defaultImageConfig = {
      type: "png",
      compression: 0, // 0-9 where 0 is fastest and 9 is slowest
      smooth: true, // adaptiveFiltering
      quality: 100, // 0-100
      resize: 1, // 0.1 to 3x
      rotate: 0, // 0-360
      roundedBorders: false, // radius in px
      padding: 0, // padding in px
      crop: null, // crop to a specific area {left, top, width, height}
    };

    // merge image config
    this.image = this.objectRecursiveMerge(this.defaultImageConfig, this.image);

    // default video config
    this.defaultVideoConfig = {
      followNewTab: true,
      fps: 60,
      videoFrame: {
        width: this.device.width ?? 1920,
        height: this.device.height ?? 1080,
      },
      videoCrf: 23,
      videoCodec: "libx264",
      videoPreset: "ultrafast", // this can have: ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
      videoBitrate: 3000,
      recordDurationLimit: 30, // in seconds
    };
    // merge video config
    this.video = this.objectRecursiveMerge(this.defaultVideoConfig, this.video);

    // default pdf config
    this.defaultPDFConfig = {
      scale: 1,
      displayHeaderFooter: false,
      headerTemplate: "",
      footerTemplate: "",
      printBackground: true,
      landscape: false,
      pageRanges: "",
      format: "A4",
      width: undefined,
      height: undefined,
      margin: {
        top: "0px",
        right: "0px",
        bottom: "0px",
        left: "0px",
      },
      preferCSSPageSize: false,
      omitBackground: false,
      timeout: this.render.timeout ?? 30000,
    };

    // merge pdf config
    this.pdf = this.objectRecursiveMerge(this.defaultPDFConfig, this.pdf);

    // Validate the config object
    let res = validateConfig(config);
    if (res?.error) {
      // throw res.message, it should be a object i am able to parse
      // where is catched
      throw new Error(JSON.stringify(res.message));
    }
  }

  objectRecursiveMerge(target, source) {
    if (typeof target !== "object" || typeof source !== "object") {
      return source;
    }

    const merged = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (
          typeof source[key] === "object" &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          merged[key] = this.objectRecursiveMerge(
            merged[key] || {},
            source[key]
          );
        } else {
          merged[key] = source[key];
        }
      }
    }

    return merged;
  }

  /**
   * @param {PageConfig} config
   */
  async initialize() {
    // BROWSER & PAGE INITIALIZATION
    this.browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    this.page = await this.browser.newPage();

    // Set scale factor & other things to simulate a real google chrome browser
    await this.page.setJavaScriptEnabled(true);
    await this.page.setCacheEnabled(this.device.cache);
    await this.page.setUserAgent(this.userAgent);

    await this.page.setViewport({
      width: this.device.width,
      height: this.device.height,
      deviceScaleFactor: this.device.scale,
    });
  }

  async renderLazyAnimations() {
    return this.page.evaluate(() => {
      return new Promise((resolve) => {
        const scrollDuration = 500;
        const startTime = performance.now();
        const startScrollY = window.scrollY;
        const endScrollY = document.body.scrollHeight - window.innerHeight;

        function smoothScroll() {
          const currentTime = performance.now();
          const elapsedTime = currentTime - startTime;

          if (elapsedTime < scrollDuration) {
            const progress = elapsedTime / scrollDuration;
            const easeInOutCubic =
              progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            window.scrollTo(
              0,
              startScrollY + (endScrollY - startScrollY) * easeInOutCubic
            );
            requestAnimationFrame(smoothScroll);
          } else {
            window.scrollTo(0, document.body.scrollHeight);
            setTimeout(() => {
              window.scrollTo(0, 0);
              setTimeout(resolve, 100);
            }, 100);
          }
        }

        smoothScroll();
      });
    });
  }

  /**
   * @param {CaptureConfig} config
   * @returns {{Promise<Buffer>, contentType: string, filename: string}}
   */
  async captureOutput() {
    if (!this.page) {
      throw new Error("Page not initialized. Call initialize() first.");
    }

    await this.page.goto(this.url, { waitUntil: this.render.waitUntil });
    if (this.render.waitTime && this.render.waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.render.waitTime));
    }

    if (this.render.triggerLazyAnimations) {
      await this.renderLazyAnimations(this.page);
    }

    if (this.render.block.cookies) {
      await blockCookies(this.page);
    }

    let content;
    let contentType;
    let filename;
    let host = new URL(this.url).hostname;

    // set config with all the properties of this class
    const config = {
      ...this,
    };

    switch (this.type) {
      case "image":
        const imageType = this.image?.type || "png";
        filename = `image-${host}-${Date.now()}.${imageType}`;
        contentType = `image/${imageType}`;
        content = await captureImage(this.page, config);
        break;
      case "pdf":
        filename = `pdf-${host}-${Date.now()}.pdf`;
        contentType = "application/pdf";
        content = await capturePDF(this.page, config);
        break;
      case "video":
        filename = `video-${host}-${Date.now()}.mp4`;
        contentType = "video/mp4";
        content = await captureVideo(this.page, config);
        break;
      case "html":
        filename = `html-${host}-${Date.now()}.html`;
        contentType = "text/html";
        content = await captureHTML(this.page, config);
        break;
      default:
        throw new Error("Invalid capture type");
    }

    return { content, contentType, filename };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
