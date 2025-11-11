<div align="center">
  <img src="https://html2pdfapi.com/logo_dark.png" alt="HTML2PDF API Logo" style="background-color: black; padding: 20px; border-radius: 8px;" width="150">
</div>

---




# Fast HTML to PDF, Screenshots, and Video API

Welcome to the **Fast HTML to PDF, Screenshots, and Video API**! 🚀

This is a lightweight version of the software used at [html2pdfapi.com](https://html2pdfapi.com).

It provides a basic yet performant wrapper along with additional features to enhance the standard Puppeteer experience.

## Features

✅ Generate PNG images from any URL or HTML content<br>
✅ Generate PDFs from any URL or HTML content<br>
✅ Generate Videos from any URL with smooth animation<br>
✅ **Direct HTML rendering** - Pass HTML content directly without needing a URL<br>
✅ Support for custom headers (like Authorization)<br>
✅ Support to render Lazy animations<br>
✅ Additional support for blocking: Cookies, Ads, Trackers, Banner<br>
✅ High-Performance webserver<br>
✅ Extended and simplified API wrapper to Puppeteer


## License

For usage in commercial services, please refer to the `license.txt` file in this repository.

Note: License is not enforced, but we are a small team, and any support to further develop this product would be greatly appreciated! 🙏

## API Usage

### Render from URL

Use the Playground at [html2pdfapi](https://html2pdfapi.com/playground) (a free account is required), to create the API request in your favorite language.
You can omit the `apiKey` parameter.

**Example - Generate PDF from URL:**
```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "type": "pdf"
  }' \
  --output output.pdf
```

### Render from HTML Content

You can now pass HTML content directly to the API without needing a URL! This is perfect for:
- Generating PDFs from dynamically created HTML
- Creating images from HTML templates
- Converting HTML email templates to images
- Any scenario where you have HTML as a string

**Example - Generate PDF from HTML:**
```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<!DOCTYPE html><html><head><title>My Document</title><style>body { font-family: Arial; padding: 40px; } h1 { color: #333; }</style></head><body><h1>Hello World!</h1><p>This PDF was generated from HTML content.</p></body></html>",
    "type": "pdf"
  }' \
  --output output.pdf
```

**Example - Generate PNG from HTML:**
```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<!DOCTYPE html><html><head><style>body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; } .card { background: rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; }</style></head><body><div class=\"card\"><h1>Beautiful Card</h1><p>Rendered from HTML!</p></div></body></html>",
    "type": "image",
    "image": { "type": "png" }
  }' \
  --output output.png
```

**Example - With Custom Options:**
```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<html><body><h1>Custom Settings</h1></body></html>",
    "type": "pdf",
    "device": {
      "width": 800,
      "height": 600
    },
    "pdf": {
      "format": "Letter",
      "printBackground": true,
      "margin": {
        "top": "20px",
        "right": "20px",
        "bottom": "20px",
        "left": "20px"
      }
    }
  }' \
  --output custom.pdf
```

**Important Notes:**
- Either `url` OR `html` must be provided (not both)
- All standard options (device settings, PDF options, image options, etc.) work with both URL and HTML modes
- When using HTML content, network idle wait conditions (`networkidle0`, `networkidle2`) are automatically adjusted to prevent timeouts

The Saas solution of our service provides out-of-the-box async support so that you don't have to implement your own.

There are many libraries you can use to achieve it, it depends on the language you are using, this is a very lightweight and versatile solution if you are looking
for a simple, yet performant solution.

## API Reference

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/render` | POST | Render URL or HTML to PDF/Image/Video |
| `/render?config=...` | GET | Render URL using GET with JSON config parameter |
| `/health` | GET | Health check with browser pool stats |
| `/docs` | GET | Swagger API documentation |

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Either url or html | URL to render |
| `html` | string | Either url or html | HTML content to render |
| `type` | string | Yes | Output type: `image`, `pdf`, `video`, `html` |
| `device` | object | No | Device settings (width, height, userAgent, etc.) |
| `render` | object | No | Render options (waitTime, fullPage, scroll, etc.) |
| `image` | object | No | Image settings (type, quality, compression, etc.) |
| `pdf` | object | No | PDF settings (format, margins, orientation, etc.) |
| `video` | object | No | Video settings (fps, duration, codec, etc.) |

For complete API documentation, visit `/docs` endpoint after starting the server.

## Getting Started with Development

To get started, run the following commands:

```
npm i
npm run dev
```

## Build and Run in Docker

### Quick usage

Install the docker image from the Github registry of this repository

```
docker pull ghcr.io/carbogninalberto/fast-html-to-pdf-api:latest
docker run -p 3000:3000 ghcr.io/carbogninalberto/fast-html-to-pdf-api:latest
```

### Prerequisites

- Docker installed on your system

### Build the Docker image

To build the Docker image, run the following command in the project root directory:

```
docker build --platform linux/amd64 . -t render
```

### Run the Docker container

To run the Docker container, use the following command:

```
docker run --platform linux/amd64 -p 3000:3000 render
```
