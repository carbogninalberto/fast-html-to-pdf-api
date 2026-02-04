<div align="center">
  <img src="https://html2pdfapi.com/logo_dark.png" alt="HTML2PDF API Logo" style="background-color: black; padding: 20px; border-radius: 8px;" width="150">
</div>

---

# Fast HTML to PDF, Screenshots, and Video API

A lightweight, high-performance rendering API built on Puppeteer. This is the open-source version of the software powering [html2pdfapi.com](https://html2pdfapi.com).
The SaaS version includes additional features out of the box:
- Async support with a job queue for background processing
- Webhook notifications when jobs complete
- Direct S3 upload to your own bucket

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
| `headers` | object | No | Custom HTTP headers to send with the request |
| `device` | object | No | Viewport settings (width, height, scale, userAgent, locale, timezone) |
| `render` | object | No | Render options (waitTime, fullPage, scroll, block) |
| `image` | object | No | Image settings (type, quality, compression, crop, resize, rotation) |
| `pdf` | object | No | PDF settings (format, width, height, margins, orientation, header/footer) |
| `video` | object | No | Video settings (fps, duration, codec, bitrate, crf, preset) |

### Device Options

Configure the browser viewport and device emulation.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `width` | number | `1920` | Viewport width in pixels |
| `height` | number | `1080` | Viewport height in pixels |
| `scale` | number | `1` | Device scale factor (DPR) |
| `userAgent` | string | Chrome default | Custom user agent string |
| `locale` | string | `en-US` | Browser locale (e.g., `fr-FR`, `de-DE`) |
| `timezone` | string | `UTC` | Timezone (e.g., `Europe/London`, `America/New_York`) |
| `javascriptEnabled` | boolean | `true` | Enable/disable JavaScript execution |

### Render Options

Control page loading and rendering behavior.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `waitTime` | number | `0` | Additional wait time after page load (ms) |
| `timeout` | number | `30000` | Page load timeout (ms) |
| `fullPage` | boolean | `false` | Capture full scrollable page (images only) |
| `triggerLazyAnimations` | boolean | `false` | Scroll page to trigger lazy-loaded content |
| `waitUntil` | string | `networkidle0` | Wait condition: `load`, `domcontentloaded`, `networkidle0`, `networkidle2` |
| `scroll.position` | number | `0` | Scroll to position before capture (px) |
| `scroll.animate` | boolean | `false` | Enable scroll animation (video) |
| `scroll.duration` | number | `5000` | Scroll animation duration (ms) |
| `scroll.animation` | string | `smooth` | Scroll animation style |
| `block.cookies` | boolean | `false` | Block cookie consent banners |
| `block.ads` | boolean | `false` | Block advertisements |
| `block.trackers` | boolean | `false` | Block tracking scripts |
| `block.banners` | boolean | `false` | Block promotional banners |

### PDF Options

Full control over PDF generation. Supports custom page dimensions with units.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `A4` | Paper format: `A0`-`A6`, `Letter`, `Legal`, `Tabloid`, `Ledger` |
| `width` | string | - | Custom width with units (e.g., `210mm`, `8.5in`, `600px`) |
| `height` | string | - | Custom height with units (e.g., `297mm`, `11in`, `800px`) |
| `landscape` | boolean | `false` | Landscape orientation |
| `scale` | number | `1` | Scale of the webpage rendering (0.1 to 2) |
| `printBackground` | boolean | `true` | Print background graphics |
| `displayHeaderFooter` | boolean | `false` | Display header and footer |
| `headerTemplate` | string | `""` | HTML template for header |
| `footerTemplate` | string | `""` | HTML template for footer |
| `pageRanges` | string | `""` | Page ranges to print (e.g., `1-5`, `1,3,5`) |
| `preferCSSPageSize` | boolean | `false` | Use CSS-defined page size |
| `omitBackground` | boolean | `false` | Hide default white background |
| `margin.top` | string | `0px` | Top margin with units |
| `margin.right` | string | `0px` | Right margin with units |
| `margin.bottom` | string | `0px` | Bottom margin with units |
| `margin.left` | string | `0px` | Left margin with units |

**Supported units:** `px`, `in`, `cm`, `mm`

> **Note:** When using custom `width` or `height`, the `format` option is automatically ignored.

### Image Options

Configure screenshot output format and post-processing.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | `png` | Output format: `png`, `jpeg`, `webp`, `gif`, `avif` |
| `quality` | number | `100` | Image quality (0-100, for jpeg/webp) |
| `compression` | number | `0` | PNG compression level (0-9, 0=fastest) |
| `smooth` | boolean | `true` | Enable adaptive filtering for PNG |
| `resize` | number | `1` | Resize factor (0.1 to 3) |
| `rotate` | number | `0` | Rotation angle (0-360 degrees) |
| `roundedBorders` | number/boolean | `false` | Border radius in pixels |
| `padding` | number | `0` | Padding in pixels |
| `crop.left` | number | - | Crop area left offset |
| `crop.top` | number | - | Crop area top offset |
| `crop.width` | number | - | Crop area width |
| `crop.height` | number | - | Crop area height |

### Video Options

Configure MP4 video recording with scroll animation.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fps` | number | `60` | Frames per second |
| `followNewTab` | boolean | `true` | Follow navigation to new tabs |
| `videoCrf` | number | `23` | Constant Rate Factor (0-51, lower=better quality) |
| `videoCodec` | string | `libx264` | Video codec |
| `videoPreset` | string | `ultrafast` | Encoding preset: `ultrafast`, `superfast`, `veryfast`, `faster`, `fast`, `medium`, `slow`, `slower`, `veryslow` |
| `videoBitrate` | number | `3000` | Bitrate in kbps (500-10000) |
| `recordDurationLimit` | number | `30` | Maximum recording duration in seconds |
| `videoFrame.width` | number | `1920` | Video frame width |
| `videoFrame.height` | number | `1080` | Video frame height |

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

**PDF with custom dimensions (mm):**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "type": "pdf",
    "pdf": {
      "width": "210mm",
      "height": "400mm",
      "margin": {"top": "10mm", "bottom": "10mm", "left": "10mm", "right": "10mm"}
    }
  }' \
  --output custom-size.pdf
```

**PDF with custom dimensions (inches - US Letter):**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "type": "pdf",
    "pdf": {
      "width": "8.5in",
      "height": "11in",
      "margin": {"top": "0.5in", "bottom": "0.5in", "left": "0.5in", "right": "0.5in"}
    }
  }' \
  --output letter.pdf
```

**Receipt/ticket PDF (narrow format):**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<html><body style=\"font-family:monospace\"><h2>RECEIPT</h2><hr><p>Item 1...$10.00</p><p>Total: $10.00</p></body></html>",
    "type": "pdf",
    "pdf": {"width": "80mm", "height": "200mm", "margin": {"top": "5mm", "bottom": "5mm", "left": "5mm", "right": "5mm"}}
  }' \
  --output receipt.pdf
```

**PDF with header and footer:**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "type": "pdf",
    "pdf": {
      "format": "A4",
      "displayHeaderFooter": true,
      "headerTemplate": "<div style=\"font-size:10px;text-align:center;width:100%\">Company Name</div>",
      "footerTemplate": "<div style=\"font-size:10px;text-align:center;width:100%\">Page <span class=\"pageNumber\"></span> of <span class=\"totalPages\"></span></div>",
      "margin": {"top": "20mm", "bottom": "20mm", "left": "10mm", "right": "10mm"}
    }
  }' \
  --output with-header-footer.pdf
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

**Mobile viewport screenshot:**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "type": "image",
    "device": {
      "width": 375,
      "height": 812,
      "scale": 2,
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15"
    }
  }' \
  --output mobile.png
```

**Full page screenshot with lazy loading:**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "type": "image",
    "render": {
      "fullPage": true,
      "triggerLazyAnimations": true,
      "waitTime": 1000
    }
  }' \
  --output fullpage.png
```

**Cropped and resized screenshot:**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "type": "image",
    "image": {
      "type": "png",
      "crop": {"left": 0, "top": 0, "width": 800, "height": 600},
      "resize": 0.5
    }
  }' \
  --output cropped.png
```

**Screenshot with custom headers and locale:**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "type": "image",
    "headers": {"Authorization": "Bearer token123"},
    "device": {"locale": "fr-FR", "timezone": "Europe/Paris"}
  }' \
  --output french.png
```

**GET request with config parameter:**

```bash
curl "http://localhost:3000/render?config=%7B%22url%22%3A%22https%3A%2F%2Fexample.com%22%2C%22type%22%3A%22image%22%7D" \
  --output screenshot.png
```

### Demo Script

A comprehensive test script is included to demonstrate PDF custom dimensions:

```bash
./pdf.demo.examples.sh
```

This generates 26 PDFs with various sizes (A3, A5, Letter, Legal, custom dimensions in mm/in/cm/px, receipts, posters, etc.) in the `pdf-demo-examples/` directory.

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
