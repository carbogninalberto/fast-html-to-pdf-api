# Fast HTML to PDF, Screenshots, and Video API

Welcome to the **Fast HTML to PDF, Screenshots, and Video API**! 🚀

This is a lightweight version of the software used at [html2pdfapi.com](https://html2pdfapi.com).

It provides a basic yet performant wrapper along with additional features to enhance the standard Puppeteer experience.

## Features

✅ Generate PNG images from any URL<br>
✅ Generate PDFs from any URL<br>
✅ Generate Videos from any URL with smooth animation<br>
✅ Support for custom headers (like Authorization)<br>
✅ Support to render Lazy animations<br>
✅ Additional support for blocking: Cookies, Ads, Trackers, Banner<br>
✅ High-Performance webserver<br>
✅ Extended and simplified API wrapper to Puppeteer


## License

For usage in commercial services, please refer to the `license.txt` file in this repository.

Note: License is not enforced, but we are a small team, and any support to further develop this product would be greatly appreciated! 🙏

## Getting Started with Development

To get started, run the following commands:

```
npm i
npm run dev
```

## Build and Run in Docker

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
