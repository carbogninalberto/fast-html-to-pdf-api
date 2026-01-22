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
    this.scalingInterval = null;
    this.initialMax = 10;
    this.lastBorrowedTime = Date.now();
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
              console.error({ err: error, retries: 0 }, "browser-pool: failed to create browser after retries");
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
          console.error({ err: error }, "browser-pool: failed to destroy browser instance");
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
          const maxAge = parseInt(process.env.POOL_MAX_BROWSER_AGE_MS) || options.maxBrowserAge || 10 * 60 * 1000;
          if (age > maxAge) {
            this.metrics.totalRecycled++;
            return false;
          }

          // Check request count-based recycling
          const maxRequests = parseInt(process.env.POOL_MAX_REQUESTS_PER_BROWSER) || options.maxRequestsPerBrowser || 100;
          if (browser._requestCount > maxRequests) {
            this.metrics.totalRecycled++;
            return false;
          }

          // Check memory usage if possible
          if (browser.process()) {
            try {
              const memUsage = process.memoryUsage();
              const maxMemory = parseInt(process.env.POOL_MAX_MEMORY_MB) || options.maxMemoryMB || 500;
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
      min: 1,
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
      console.error({ err }, "browser-pool: factory create error");
      this.emit("poolError", { type: "create", error: err });
    });

    this.pool.on("factoryDestroyError", (err) => {
      this.metrics.totalErrors++;
      console.error({ err }, "browser-pool: factory destroy error");
      this.emit("poolError", { type: "destroy", error: err });
    });

    this.initialMax = poolOptions.max;

    // Setup graceful shutdown
    this.setupShutdownHandlers();

    // Start dynamic pool scaling check
    this.startDynamicScaling();

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

  startDynamicScaling() {
    const idleThresholdMs = 5 * 60 * 1000;

    this.scalingInterval = setInterval(() => {
      if (!this.pool || this.isShuttingDown) return;

      const max = this.pool.max;
      const borrowed = this.pool.borrowed;
      const threshold = max - Math.floor(max / 5);

      if (borrowed > 0) {
        this.lastBorrowedTime = Date.now();
      }

      // Max scaling
      if (borrowed >= threshold) {
        this.pool.max = max + 10;
        console.log(`Pool scaled up: max ${max} -> ${this.pool.max}`);
      } else if (max > this.initialMax && borrowed < max - 10) {
        const newMax = Math.max(max - 10, this.initialMax);
        this.pool.max = newMax;
        console.log(`Pool scaled down: max ${max} -> ${newMax}`);
      }

      // Min scaling
      const currentMin = this.pool.min;
      if (borrowed >= this.pool.size) {
        // All instances busy: increase min by 1
        this.pool.min = currentMin + 1;
      } else if (currentMin > 1 && (Date.now() - this.lastBorrowedTime) > idleThresholdMs) {
        // Idle for 5+ minutes: decrease min to 1
        this.pool.min = 1;
      }
    }, 10000);
  }

  stopDynamicScaling() {
    if (this.scalingInterval) {
      clearInterval(this.scalingInterval);
      this.scalingInterval = null;
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
      console.error({ err: error }, "browser-pool: failed to warm up pool");
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

        // Recreate page for clean state
        await this.resetPage(resource);

        this.metrics.totalAcquired++;
        this.emit("browserAcquired", {
          duration: Date.now() - startTime,
          poolStats: this.getStats()
        });

        return resource;
      } catch (error) {
        lastError = error;
        console.warn({ err: error, attempt: i + 1, maxRetries }, "browser-pool: failed to acquire browser");

        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }

    this.metrics.totalErrors++;
    throw lastError || new Error("Failed to acquire browser from pool");
  }

  async resetPage(resource) {
    try {
      const { browser, page } = resource;

      // Close old page and create a fresh one
      if (page && !page.isClosed()) {
        page.removeAllListeners();
        await page.close().catch(() => {});
      }

      const newPage = await browser.newPage();

      newPage.on("error", (err) => {
        this.metrics.totalErrors++;
        this.emit("pageError", { error: err });
      });
      newPage.on("pageerror", (err) => {
        this.metrics.totalErrors++;
        this.emit("pageError", { error: err });
      });

      resource.page = newPage;
    } catch (error) {
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
      console.error({ err: error }, "browser-pool: error releasing browser to pool");
      this.metrics.totalErrors++;

      // Try to destroy the problematic resource
      try {
        await this.pool.destroy(resource);
      } catch (destroyError) {
        console.error({ err: destroyError }, "browser-pool: failed to destroy problematic browser");
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
      // Stop scaling and cleanup
      this.stopDynamicScaling();
      this.stopPeriodicCleanup();

      // Drain and clear the pool
      await this.pool.drain();
      await this.pool.clear();

      // Final cleanup of temp files
      await this.cleanupChromeTempFiles();

      console.log("Browser pool drained and cleared");
      this.emit("poolDrained");
    } catch (error) {
      console.error({ err: error }, "browser-pool: error draining pool");
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