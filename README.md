<div align="center">
  <img src="https://html2pdfapi.com/logo_dark.png" alt="HTML2PDF API Logo" style="background-color: black; padding: 20px; border-radius: 8px;" width="150">
</div>

---

# Fast HTML to PDF, Screenshots, and Video API

A lightweight, high-performance rendering API built on Puppeteer. This is the open-source version of the software powering [html2pdfapi.com](https://html2pdfapi.com).

## Features

- 📸 PNG, JPEG, WebP, GIF, AVIF screenshots from any URL or HTML
- 📄 PDF generation with full page layout control
- 🎬 MP4 video recording with smooth scroll animation
- 🌐 Full HTML capture with all resources embedded inline
- ⚡ Browser pool with configurable recycling and warmup
- 🔧 Structured JSON logging (Pino)
- 🐳 Docker-ready with CI pipeline

## Getting Started

### Requirements

- Node.js 24+
- FFmpeg (for video recording)

### Local Development

```bash
npm install
npm run dev
```

The server starts on `http://localhost:3000`. API docs are available at `/docs`.

For video support on macOS (Homebrew):

```bash
FFMPEG_PATH=/opt/homebrew/bin/ffmpeg npm run dev
```

### Docker

Pull from the GitHub Container Registry:

```bash
docker pull ghcr.io/carbogninalberto/fast-html-to-pdf-api:latest
docker run -p 3000:3000 ghcr.io/carbogninalberto/fast-html-to-pdf-api:latest
```

Or build locally:

```bash
docker build . -t bakney/fastrender
docker run -p 3000:3000 bakney/fastrender
```

For ARM-based machines (Apple Silicon):

```bash
docker build --platform linux/amd64 . -t render
docker run --platform linux/amd64 -p 3000:3000 render
```

## API Usage

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/render` | POST | Render URL or HTML to PDF/Image/Video/HTML |
| `/render?config=...` | GET | Same as above, with JSON config as query param |
| `/health` | GET | Health check with browser pool stats |
| `/ping` | GET | Simple connectivity check (returns `"pong"`) |
| `/docs` | GET | Swagger API documentation |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | One of `url` or `html` | URL to render |
| `html` | string | One of `url` or `html` | Raw HTML content to render |
| `type` | string | Yes | `image`, `pdf`, `video`, or `html` |
| `device` | object | No | Viewport settings (width, height, userAgent) |
| `render` | object | No | Render options (waitTime, fullPage, scroll) |
| `image` | object | No | Image settings (type, quality, compression, crop, resize, rotation) |
| `pdf` | object | No | PDF settings (format, margins, orientation, header/footer) |
| `video` | object | No | Video settings (fps, duration, codec, bitrate, crf, preset) |

### Examples

**Screenshot from URL:**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "type": "image"}' \
  --output screenshot.png
```

**PDF from HTML:**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>",
    "type": "pdf",
    "pdf": {"format": "A4", "margin": {"top": "20px", "bottom": "20px"}}
  }' \
  --output output.pdf
```

**WebP image with custom quality:**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "type": "image", "image": {"type": "webp", "quality": 80}}' \
  --output output.webp
```

**Video with scroll animation:**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "type": "video",
    "video": {"fps": 24},
    "render": {"scroll": {"animate": true, "duration": 3000}}
  }' \
  --output output.mp4
```

**Full HTML capture (resources embedded as data URIs):**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "type": "html"}' \
  --output page.html
```

**GET request with config parameter:**

```bash
curl "http://localhost:3000/render?config=%7B%22url%22%3A%22https%3A%2F%2Fexample.com%22%2C%22type%22%3A%22image%22%7D" \
  --output screenshot.png
```

## Configuration

All settings are driven by environment variables with sensible defaults.

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | `3000` | HTTP server port |
| `BODY_LIMIT_BYTES` | `52428800` | Max request body size (50 MB) |
| `SHUTDOWN_TIMEOUT_MS` | `30000` | Graceful shutdown timeout |
| `LOG_LEVEL` | `info` | Log level (trace, debug, info, warn, error, fatal) |

### Browser Pool

| Variable | Default | Description |
|----------|---------|-------------|
| `POOL_MIN` | `2` | Minimum browser instances |
| `POOL_MAX` | `10` | Maximum browser instances |
| `POOL_ACQUIRE_TIMEOUT_MS` | `30000` | Max wait to acquire a browser |
| `POOL_IDLE_TIMEOUT_MS` | `30000` | Idle time before eviction |
| `BROWSER_MAX_AGE_MS` | `600000` | Max browser lifetime (10 min) |
| `BROWSER_MAX_REQUESTS` | `100` | Max requests per browser before recycling |
| `BROWSER_MAX_MEMORY_MB` | `500` | Memory limit per browser |

### Video

| Variable | Default | Description |
|----------|---------|-------------|
| `FFMPEG_PATH` | `/usr/bin/ffmpeg` | Path to FFmpeg binary |
| `VIDEO_MAX_SCROLL_DURATION_MS` | `20000` | Max scroll animation duration |

### Viewport

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_VIEWPORT_WIDTH` | `1920` | Default viewport width |
| `DEFAULT_VIEWPORT_HEIGHT` | `1080` | Default viewport height |

## Testing

### Unit Tests

```bash
npm test
```

With coverage report (97% line coverage required):

```bash
npm run coverage
```

### End-to-End Tests

Requires a running server on port 3000:

```bash
# Terminal 1: start the server
FFMPEG_PATH=/opt/homebrew/bin/ffmpeg node app/server.js

# Terminal 2: run E2E tests
npm run test:e2e
```

E2E tests validate output format correctness using magic bytes (PNG, WebP, PDF headers, MP4 ftyp box, HTML structure).

### CI

The GitHub Actions workflow runs on every push:

1. Unit tests with 97% coverage gate
2. Docker build
3. E2E tests against the running container

## Health Check

`GET /health` returns pool status and memory usage:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-22T12:00:00.000Z",
  "browserPool": {
    "available": 2,
    "borrowed": 1,
    "pending": 0,
    "min": 2,
    "max": 10
  },
  "uptime": 3600,
  "memory": {
    "used": "256 MB",
    "total": "512 MB"
  }
}
```

Returns `200` when healthy, `503` when degraded (no browsers available).

## License

For usage in commercial services, please refer to the `license.txt` file in this repository.

Note: License is not enforced, but we are a small team, and any support to further develop this product would be greatly appreciated! 🙏
