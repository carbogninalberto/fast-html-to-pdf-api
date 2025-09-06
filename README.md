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

## How to create your API call

Use the Playground at [html2pdfapi](https://html2pdfapi.com/playground) (a free account is required), to create the API request in your favorite language.
You can omit the `apiKey` parameter.

The Saas solution of our service provides out-of-the-box async support so that you don't have to implement your own.

There are many libraries you can use to achieve it, it depends on the language you are using, this is a very lightweight and versatile solution if you are looking
for a simple, yet performant solution.

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
