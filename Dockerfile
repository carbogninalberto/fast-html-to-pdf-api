FROM node:24-trixie-slim AS dependencies

WORKDIR /usr/src/app

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    SHARP_IGNORE_GLOBAL_LIBVIPS=1

COPY package*.json ./

RUN npm ci --omit=dev \
    && rm -rf node_modules/@ffmpeg-installer

FROM debian:13-slim

WORKDIR /usr/src/app

COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    HOST=0.0.0.0

ARG CHROME_VERSION=156.0.8078.73-1
ARG CHROME_SHA256=fd19c6895dad77f4d7f712c2d9f0d5eb682f4a6e7ff22b1bd0d40d03710d288c

RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget \
    && wget -q "https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_${CHROME_VERSION}_amd64.deb" -O /tmp/chrome.deb \
    && echo "${CHROME_SHA256}  /tmp/chrome.deb" | sha256sum -c - \
    && apt-get install -y --no-install-recommends /tmp/chrome.deb ffmpeg tini \
    && rm -rf /var/lib/apt/lists/* /tmp/chrome.deb \
    && useradd --uid 1001 --create-home appuser

COPY --from=dependencies --chown=appuser:appuser /usr/src/app/node_modules ./node_modules
COPY --chown=appuser:appuser package*.json ./
COPY --chown=appuser:appuser app ./app

USER appuser

EXPOSE 3000

ENTRYPOINT ["tini", "--"]
CMD ["node", "app/server.js"]
