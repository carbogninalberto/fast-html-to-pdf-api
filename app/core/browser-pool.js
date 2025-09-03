import puppeteer from "puppeteer";
import genericPool from "generic-pool";

class BrowserPool {
  constructor() {
    this.pool = null;
    this.isShuttingDown = false;
  }

  initialize(options = {}) {
    const factory = {
      create: async () => {
        try {
          const browser = await puppeteer.launch({
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-gpu",
              "--no-first-run",
              "--no-zygote",
              "--disable-background-timer-throttling",
              "--disable-backgrounding-occluded-windows",
              "--disable-renderer-backgrounding",
              "--disable-features=site-per-process",
              "--disable-blink-features=AutomationControlled",
              "--disable-web-security",
              "--disable-features=IsolateOrigins,site-per-process",
            ],
            ...options.browserOptions,
          });
          
          browser._poolCreatedAt = Date.now();
          
          // Create a single page that will be reused
          const page = await browser.newPage();
          
          return { browser, page };
        } catch (error) {
          console.error("Failed to create browser instance:", error);
          throw error;
        }
      },
      destroy: async (resource) => {
        try {
          if (resource.page && !resource.page.isClosed()) {
            await resource.page.close();
          }
          if (resource.browser && resource.browser.isConnected()) {
            await resource.browser.close();
          }
        } catch (error) {
          console.error("Failed to destroy browser instance:", error);
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
          
          // Recycle browsers after 30 minutes to prevent memory leaks
          const age = Date.now() - resource.browser._poolCreatedAt;
          if (age > 30 * 60 * 1000) {
            return false;
          }
          
          // Test if page is responsive
          await resource.page.evaluate(() => true);
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

    // Handle pool errors
    this.pool.on("factoryCreateError", (err) => {
      console.error("Browser pool factory create error:", err);
    });

    this.pool.on("factoryDestroyError", (err) => {
      console.error("Browser pool factory destroy error:", err);
    });

    // Pre-warm the pool
    this.warmUp();
  }

  async warmUp() {
    try {
      const minSize = this.pool.min;
      const promises = [];
      
      for (let i = 0; i < minSize; i++) {
        promises.push(
          this.pool.acquire().then((resource) => {
            this.pool.release(resource);
          })
        );
      }
      
      await Promise.all(promises);
      console.log(`Browser pool warmed up with ${minSize} instances`);
    } catch (error) {
      console.error("Failed to warm up browser pool:", error);
    }
  }

  async acquire() {
    if (this.isShuttingDown) {
      throw new Error("Browser pool is shutting down");
    }
    
    try {
      const resource = await this.pool.acquire();
      
      // Only clear minimal state for performance
      await this.fastClear(resource.page);
      
      return resource;
    } catch (error) {
      console.error("Failed to acquire browser from pool:", error);
      throw error;
    }
  }

  async fastClear(page) {
    try {
      // Skip navigation to about:blank for performance
      // Only reset critical settings that might affect next render
      await page.setViewport({ width: 1920, height: 1080 });
    } catch (error) {
      // Ignore errors - page might still be usable
    }
  }

  async clearPage(page) {
    try {
      // Navigate to blank page to clear any state
      await page.goto("about:blank", { waitUntil: "domcontentloaded" });
      
      // Clear cookies
      const cookies = await page.cookies();
      if (cookies.length > 0) {
        await page.deleteCookie(...cookies);
      }
      
      // Clear local storage and session storage
      await page.evaluate(() => {
        if (typeof localStorage !== 'undefined') localStorage.clear();
        if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
      });
      
      // Reset viewport to default
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Clear any extra HTTP headers
      await page.setExtraHTTPHeaders({});
      
      // Reset user agent
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      );
    } catch (error) {
      console.error("Error clearing page state:", error);
      // Don't throw - page might still be usable
    }
  }

  async release(resource) {
    try {
      // Skip clearing for performance - fastClear is done on acquire
      await this.pool.release(resource);
    } catch (error) {
      console.error("Error releasing browser to pool:", error);
      
      // If release fails, try to destroy the resource
      try {
        await this.pool.destroy(resource);
      } catch (destroyError) {
        console.error("Failed to destroy problematic browser:", destroyError);
      }
    }
  }

  async drain() {
    this.isShuttingDown = true;
    
    try {
      await this.pool.drain();
      await this.pool.clear();
      console.log("Browser pool drained and cleared");
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
    };
  }
}

// Create singleton instance
const browserPool = new BrowserPool();

export default browserPool;