# Self-hosted image: the Bun server, the prerendered frontend, and the migrations.
# TLS is not terminated here; see "Self-hosted with Bun and Docker" in README.md.

# Keep in step with "packageManager" in package.json.
ARG BUN_VERSION=1.3.4
# vite-ssg and the Vite toolchain run on Node 22.12 or newer.
ARG NODE_VERSION=24

FROM oven/bun:${BUN_VERSION} AS bun

FROM node:${NODE_VERSION}-bookworm-slim AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

COPY package.json bun.lock ./
COPY web-vue/package.json web-vue/
COPY server/package.json server/
COPY server-shared/contracts/package.json server-shared/contracts/
RUN bun install --frozen-lockfile

COPY . .
# Public, not a secret: canonical URLs, robots.txt and sitemap.xml are built from it,
# and the server refuses a production start with a different APP_ORIGIN.
ARG APP_ORIGIN=""
RUN APP_ORIGIN="${APP_ORIGIN}" bun run build:web && bun run build:server

FROM oven/bun:${BUN_VERSION}-slim
WORKDIR /app

COPY --from=build /app/dist/web-vue dist/web-vue
COPY --from=build /app/dist/server dist/server
COPY --from=build /app/dist/build-info.json dist/build-info.json
COPY --from=build /app/server/migrations server/migrations

RUN mkdir /data && chown bun:bun /data
USER bun
VOLUME /data

# ENVIRONMENT, APP_HOST, APP_ORIGIN and SESSION_SECRET are deliberately unset: the
# server refuses to start until the deployment provides them.
ENV LISTEN_HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/data/app.sqlite
EXPOSE 3000

# Host validation rejects any other host, so the check must send APP_HOST.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "const response = await fetch(`http://127.0.0.1:${process.env.PORT}/health`, { headers: { host: process.env.APP_HOST ?? '' } }); process.exit(response.ok ? 0 : 1)"]

CMD ["bun", "dist/server/bun.js"]
