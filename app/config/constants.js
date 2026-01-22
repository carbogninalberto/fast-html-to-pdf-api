const env = (key, fallback) => {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return typeof fallback === "number" ? Number(val) : val;
};

// Server
export const SERVER_PORT = env("SERVER_PORT", 3000);
export const PLUGIN_TIMEOUT_MS = env("PLUGIN_TIMEOUT_MS", 60000);
export const BODY_LIMIT_BYTES = env("BODY_LIMIT_BYTES", 50 * 1024 * 1024);
export const SHUTDOWN_TIMEOUT_MS = env("SHUTDOWN_TIMEOUT_MS", 30000);

// Browser Pool
export const POOL_MIN = env("POOL_MIN", 2);
export const POOL_MAX = env("POOL_MAX", 10);
export const POOL_ACQUIRE_TIMEOUT_MS = env("POOL_ACQUIRE_TIMEOUT_MS", 30000);
export const POOL_CREATE_TIMEOUT_MS = env("POOL_CREATE_TIMEOUT_MS", 30000);
export const POOL_DESTROY_TIMEOUT_MS = env("POOL_DESTROY_TIMEOUT_MS", 5000);
export const POOL_IDLE_TIMEOUT_MS = env("POOL_IDLE_TIMEOUT_MS", 30000);
export const POOL_EVICTION_INTERVAL_MS = env("POOL_EVICTION_INTERVAL_MS", 60000);
export const POOL_SCALE_INCREMENT = env("POOL_SCALE_INCREMENT", 10);
export const POOL_SCALE_CHECK_INTERVAL_MS = env("POOL_SCALE_CHECK_INTERVAL_MS", 10000);
export const POOL_IDLE_SCALE_DOWN_MS = env("POOL_IDLE_SCALE_DOWN_MS", 5 * 60 * 1000);

// Browser
export const BROWSER_LAUNCH_TIMEOUT_MS = env("BROWSER_LAUNCH_TIMEOUT_MS", 30000);
export const BROWSER_MAX_RETRIES = env("BROWSER_MAX_RETRIES", 3);
export const BROWSER_RETRY_DELAY_MS = env("BROWSER_RETRY_DELAY_MS", 1000);
export const BROWSER_MAX_AGE_MS = env("BROWSER_MAX_AGE_MS", 10 * 60 * 1000);
export const BROWSER_MAX_REQUESTS = env("BROWSER_MAX_REQUESTS", 100);
export const BROWSER_MAX_MEMORY_MB = env("BROWSER_MAX_MEMORY_MB", 500);
export const BROWSER_PAGE_TIMEOUT_MS = env("BROWSER_PAGE_TIMEOUT_MS", 5000);

// Viewport
export const DEFAULT_VIEWPORT_WIDTH = env("DEFAULT_VIEWPORT_WIDTH", 1920);
export const DEFAULT_VIEWPORT_HEIGHT = env("DEFAULT_VIEWPORT_HEIGHT", 1080);

// Cleanup
export const CLEANUP_INTERVAL_MS = env("CLEANUP_INTERVAL_MS", 5 * 60 * 1000);
export const TEMP_FILE_MAX_AGE_MS = env("TEMP_FILE_MAX_AGE_MS", 5 * 60 * 1000);
export const TEMP_DIR_MAX_AGE_MS = env("TEMP_DIR_MAX_AGE_MS", 30 * 60 * 1000);

// Image
export const IMAGE_RESIZE_MIN = env("IMAGE_RESIZE_MIN", 0.1);
export const IMAGE_RESIZE_MAX = env("IMAGE_RESIZE_MAX", 3);

// Video
export const VIDEO_MAX_SCROLL_DURATION_MS = env("VIDEO_MAX_SCROLL_DURATION_MS", 20000);

// HTML Capture
export const HTML_CAPTURE_MAX_SIZE_BYTES = env("HTML_CAPTURE_MAX_SIZE_BYTES", 500 * 1024 * 1024);
