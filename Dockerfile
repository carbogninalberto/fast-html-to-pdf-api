FROM node:24-bookworm-slim AS dependencies

WORKDIR /usr/src/app

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    SHARP_IGNORE_GLOBAL_LIBVIPS=1

COPY package*.json ./

RUN npm ci --omit=dev \
    && rm -rf node_modules/@ffmpeg-installer

FROM node:24-bookworm-slim

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    HOST=0.0.0.0 \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget \
    && wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/chrome.deb \
    && apt-get install -y --no-install-recommends /tmp/chrome.deb ffmpeg \
    && rm -rf /var/lib/apt/lists/* /tmp/chrome.deb

COPY --from=dependencies --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node app ./app

USER node

EXPOSE 3000

CMD ["node", "app/server.js"]
