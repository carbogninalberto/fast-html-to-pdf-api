import puppeteer from "puppeteer";
import genericPool from "generic-pool";
import { EventEmitter } from "events";
import fs from "fs/promises";
import path from "path";

class BrowserPool extends EventEmitter {
  constructor() {
    super();
    this.pool = null;
    this.isShuttingDown = false;
    this.cleanupInterval = null;
    this.metrics = {
      totalAcquired: 0,
      totalReleased: 0,
      totalErrors: 0,
      totalRecycled: 0,
      tempFilesCleanedUp: 0,
    };
  }

  initialize(options = {}) {
    const defaultBrowserArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-zygote",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disk-cache-dir=/tmp/chrome-cache",
      "--disk-cache-size=104857600", // 100MB max
      "--media-cache-size=104857600",
      "--aggressive-cache-discard",
      "--temp-dir=/tmp",  // Explicitly set temp directory
      "--no-first-run",
      "--disable-features=site-per-process",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-hang-monitor",
      "--disable-default-apps",
      "--mute-audio",
      "--disable-translate",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
      `--window-size=${options.windowWidth || 1920},${options.windowHeight || 1080}`,
    ];

    const factory = {
      create: async () => {
        const startTime = Date.now();
        let retries = 3;

        while (retries > 0) {
          try {
            const browser = await puppeteer.launch({
              headless: options.headless !== false ? "new" : false,
              args: options.browserArgs || defaultBrowserArgs,
              timeout: options.launchTimeout || 30000,
              ...options.browserOptions,
            });

            browser._poolCreatedAt = Date.now();
            browser._requestCount = 0;

            // Set up browser event handlers
            browser.on("disconnected", () => {
              this.emit("browserDisconnected", { browserId: browser.process()?.pid });
            });

            // Create page with optimizations
            const page = await browser.newPage();

            // Set up page error handlers
            page.on("error", (err) => {
              this.metrics.totalErrors++;
              this.emit("pageError", { error: err });
            });

            page.on("pageerror", (err) => {
              this.metrics.totalErrors++;
              this.emit("pageError", { error: err });
            });

            // Performance optimizations
            await page.setDefaultNavigationTimeout(options.navigationTimeout || 30000);
            await page.setDefaultTimeout(options.pageTimeout || 30000);

            // Block unnecessary resources for better performance
            if (options.blockResources) {
              await page.setRequestInterception(true);
              page.on("request", (req) => {
                const resourceType = req.resourceType();
                if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
                  req.abort();
                } else {
                  req.continue();
                }
              });
            }

            // Set cache
            await page.setCacheEnabled(options.cacheEnabled !== false);

            const resource = { browser, page, createdAt: Date.now() };
            this.emit("browserCreated", {
              browserId: browser.process()?.pid,
              duration: Date.now() - startTime
            });

            return resource;
          } catch (error) {
            retries--;
            if (retries === 0) {
              this.metrics.totalErrors++;
              console.error("Failed to create browser after retries:", error);
              throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      },

      destroy: async (resource) => {
        const startTime = Date.now();
        try {
          // Clean up event listeners
          if (resource.page) {
            resource.page.removeAllListeners();
            if (!resource.page.isClosed()) {
              await resource.page.close().catch(() => {});
            }
          }

          if (resource.browser) {
            resource.browser.removeAllListeners();
            if (resource.browser.isConnected()) {
              await resource.browser.close();
            }
          }

          // Clean up Chrome temp files after browser destruction
          this.cleanupChromeTempFiles().catch((err) => {
            console.warn("Non-critical: Failed to clean Chrome temp files:", err.message);
          });

          this.emit("browserDestroyed", {
            duration: Date.now() - startTime,
            lifetime: Date.now() - resource.createdAt
          });
        } catch (error) {
          console.error("Failed to destroy browser instance:", error);
          this.metrics.totalErrors++;
        }
      },

      validate: async (resource) => {
        try {
          if (!resource.browser || !resource.browser.isConnected()) {
            return false;
          }

          if (!resource.page || resource.page.isClosed()) {
            return false;
          }

          const browser = resource.browser;

          // Check age-based recycling
          const age = Date.now() - browser._poolCreatedAt;
          const maxAge = options.maxBrowserAge || 10 * 60 * 1000;
          if (age > maxAge) {
            this.metrics.totalRecycled++;
            return false;
          }

          // Check request count-based recycling
          const maxRequests = options.maxRequestsPerBrowser || 100;
          if (browser._requestCount > maxRequests) {
            this.metrics.totalRecycled++;
            return false;
          }

          // Check memory usage if possible
          if (browser.process()) {
            try {
              const memUsage = process.memoryUsage();
              const maxMemory = options.maxMemoryMB || 500;
              if (memUsage.heapUsed / 1024 / 1024 > maxMemory) {
                this.metrics.totalRecycled++;
                return false;
              }
            } catch (e) {
              // Ignore memory check errors
            }
          }

          // Test page responsiveness
          await Promise.race([
            resource.page.evaluate(() => true),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Page unresponsive")), 5000)
            )
          ]);

          return true;
        } catch (error) {
          return false;
        }
      },
    };

    const poolOptions = {
      min: options.min || 1,
      max: options.max || 5,
      acquireTimeoutMillis: options.acquireTimeout || 30000,
      createTimeoutMillis: options.createTimeout || 30000,
      destroyTimeoutMillis: options.destroyTimeout || 5000,
      idleTimeoutMillis: options.idleTimeout || 30000,
      evictionRunIntervalMillis: options.evictionInterval || 60000,
      testOnBorrow: true,
      testOnReturn: false,
      autostart: true,
      ...options.poolOptions,
    };

    this.pool = genericPool.createPool(factory, poolOptions);

    // Handle pool events
    this.pool.on("factoryCreateError", (err) => {
      this.metrics.totalErrors++;
      console.error("Browser pool factory create error:", err);
      this.emit("poolError", { type: "create", error: err });
    });

    this.pool.on("factoryDestroyError", (err) => {
      this.metrics.totalErrors++;
      console.error("Browser pool factory destroy error:", err);
      this.emit("poolError", { type: "destroy", error: err });
    });

    // Setup graceful shutdown
    this.setupShutdownHandlers();

    // Start periodic cleanup of Chrome temp files
    this.startPeriodicCleanup(options.cleanupInterval || 5 * 60 * 1000); // Default: 5 minutes

    // Pre-warm if not disabled
    if (options.warmUp !== false) {
      this.warmUp().catch(console.error);
    }
  }

  /**
   * Clean up Chrome temporary files
   * Removes .com.google.Chrome.* files that are older than 5 minutes
   */
  async cleanupChromeTempFiles() {
    try {
      const tmpDir = "/tmp";
      const now = Date.now();
      const fiveMinMs = 5 * 60 * 1000;
      const thirtyMinMs = 30 * 60 * 1000;

      let entries;
      try {
        entries = await fs.readdir(tmpDir, { withFileTypes: true });
      } catch (err) {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(tmpDir, entry.name);
        try {
          const stat = await fs.stat(fullPath);
          const age = now - stat.mtimeMs;

          if (entry.name.startsWith(".com.google.Chrome.") && entry.isFile() && age > fiveMinMs) {
            await fs.unlink(fullPath);
          } else if (entry.name.startsWith("puppeteer_dev_chrome_profile-") && entry.isDirectory() && age > thirtyMinMs) {
            await fs.rm(fullPath, { recursive: true, force: true });
          } else if (entry.name === "Crashpad" && entry.isDirectory() && age > thirtyMinMs) {
            await fs.rm(fullPath, { recursive: true, force: true });
          }
        } catch (err) {
          // Ignore errors - files might not exist or already deleted
        }
      }

      this.metrics.tempFilesCleanedUp++;
      this.emit("tempFilesCleanedUp");
    } catch (error) {
      console.warn("Chrome temp file cleanup warning:", error.message);
    }
  }

  /**
   * Start periodic cleanup interval
   */
  startPeriodicCleanup(intervalMs) {
    // Clear existing interval if any
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Run cleanup immediately
    this.cleanupChromeTempFiles().catch(() => {});

    // Setup periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupChromeTempFiles().catch(() => {});
    }, intervalMs);

    console.log(`Chrome temp file cleanup scheduled every ${intervalMs / 1000} seconds`);
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log("Periodic cleanup stopped");
    }
  }

  async warmUp() {
    try {
      const minSize = this.pool.min;
      const promises = [];

      for (let i = 0; i < minSize; i++) {
        promises.push(
          this.pool.acquire()
            .then((resource) => this.pool.release(resource))
            .catch((err) => {
              console.warn(`Failed to warm up browser ${i + 1}:`, err.message);
            })
        );
      }

      await Promise.allSettled(promises);
      const succeeded = promises.filter(p => p.status === 'fulfilled').length;
      console.log(`Browser pool warmed up with ${succeeded}/${minSize} instances`);
    } catch (error) {
      console.error("Failed to warm up browser pool:", error);
    }
  }

  async acquire(options = {}) {
    if (this.isShuttingDown) {
      throw new Error("Browser pool is shutting down");
    }

    const startTime = Date.now();
    let lastError;
    const maxRetries = options.retries || 3;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const resource = await this.pool.acquire();

        // Increment request counter
        resource.browser._requestCount++;

        // Clear page state
        await this.resetPage(resource.page, options.clearLevel || "fast");

        this.metrics.totalAcquired++;
        this.emit("browserAcquired", {
          duration: Date.now() - startTime,
          poolStats: this.getStats()
        });

        return resource;
      } catch (error) {
        lastError = error;
        console.warn(`Failed to acquire browser (attempt ${i + 1}/${maxRetries}):`, error.message);

        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }

    this.metrics.totalErrors++;
    throw lastError || new Error("Failed to acquire browser from pool");
  }

  async resetPage(page, clearLevel = "fast") {
    try {
      switch (clearLevel) {
        case "none":
          // Do nothing
          break;

        case "fast":
          // Minimal reset for performance
          await page.setViewport({ width: 1920, height: 1080 });
          break;

        case "medium":
          // Reset page but keep browser state
          await Promise.all([
            page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 5000 }),
            page.setViewport({ width: 1920, height: 1080 }),
          ]);
          break;

        case "full":
          // Complete reset
          await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 5000 });

          // Clear cookies
          const cookies = await page.cookies();
          if (cookies.length > 0) {
            await page.deleteCookie(...cookies);
          }

          // Clear storage
          await page.evaluate(() => {
            try {
              localStorage.clear();
              sessionStorage.clear();
              // Clear IndexedDB
              if (indexedDB && indexedDB.databases) {
                indexedDB.databases().then(databases => {
                  databases.forEach(db => indexedDB.deleteDatabase(db.name));
                });
              }
            } catch (e) {}
          });

          // Reset settings
          await Promise.all([
            page.setViewport({ width: 1920, height: 1080 }),
            page.setExtraHTTPHeaders({}),
            page.setUserAgent(
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
          ]);
          break;
      }
    } catch (error) {
      // Log but don't throw - page might still be usable
      console.warn("Error resetting page state:", error.message);
    }
  }

  async release(resource, options = {}) {
    try {
      this.metrics.totalReleased++;

      // Mark as invalid if requested
      if (options.destroy) {
        await this.pool.destroy(resource);
      } else {
        await this.pool.release(resource);
      }

      this.emit("browserReleased", { poolStats: this.getStats() });
    } catch (error) {
      console.error("Error releasing browser to pool:", error);
      this.metrics.totalErrors++;

      // Try to destroy the problematic resource
      try {
        await this.pool.destroy(resource);
      } catch (destroyError) {
        console.error("Failed to destroy problematic browser:", destroyError);
      }
    }
  }

  setupShutdownHandlers() {
    const shutdown = async (signal) => {
      console.log(`Received ${signal}, shutting down browser pool...`);
      await this.drain();
      process.exit(0);
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  }

  async drain() {
    this.isShuttingDown = true;

    try {
      // Stop periodic cleanup
      this.stopPeriodicCleanup();

      // Drain and clear the pool
      await this.pool.drain();
      await this.pool.clear();

      // Final cleanup of temp files
      await this.cleanupChromeTempFiles();

      console.log("Browser pool drained and cleared");
      this.emit("poolDrained");
    } catch (error) {
      console.error("Error draining browser pool:", error);
    }
  }

  getStats() {
    if (!this.pool) {
      return null;
    }

    return {
      size: this.pool.size,
      available: this.pool.available,
      borrowed: this.pool.borrowed,
      pending: this.pool.pending,
      max: this.pool.max,
      min: this.pool.min,
      metrics: { ...this.metrics },
    };
  }

  // Health check method
  async healthCheck() {
    try {
      const stats = this.getStats();
      const health = {
        status: "healthy",
        stats,
        uptime: process.uptime(),
      };

      // Check if pool is functioning
      if (this.isShuttingDown) {
        health.status = "shutting_down";
      } else if (stats.available === 0 && stats.pending > 2) {
        health.status = "degraded";
        health.reason = "High pending requests";
      } else if (this.metrics.totalErrors > 100) {
        health.status = "degraded";
        health.reason = "High error rate";
      }

      return health;
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
      };
    }
  }
}

// Create singleton instance
const browserPool = new BrowserPool();

export default browserPool;