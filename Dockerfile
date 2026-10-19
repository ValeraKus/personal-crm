# syntax=docker/dockerfile:1

# Production image of the app. GitHub Actions builds it, the server runs it with docker compose.
# Besides the app, the same image runs one-off tools from /app/tools:
# migrations (scripts/migrate.js) and test data (scripts/seed.js).

FROM node:24-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# src/db requires DATABASE_URL on import, but the build never connects: all pages are dynamic.
# The placeholder lives only in this step; the running app gets the real value from the server.
RUN DATABASE_URL=postgres://build:build@127.0.0.1:5432/build pnpm build
# Tools: scripts compiled to JavaScript, migration files and the only packages they need
RUN pnpm exec tsc -p tsconfig.tools.json \
  && cp -r drizzle build/tools/drizzle \
  && mkdir -p build/tools/node_modules/@next \
  && cp -rL node_modules/drizzle-orm node_modules/postgres build/tools/node_modules/ \
  && cp -rL node_modules/@next/env build/tools/node_modules/@next/

FROM base AS runner
ENV NODE_ENV=production \
  PORT=3000 \
  HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build /app/build/tools ./tools
# Git commit of this build, shown by /health
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
USER node
EXPOSE 3000
CMD ["node", "server.js"]
