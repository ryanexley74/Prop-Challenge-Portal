# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 · deps — install all workspace dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable pnpm

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json tsconfig.json ./
COPY lib/        ./lib/
COPY scripts/    ./scripts/
COPY artifacts/api-server/       ./artifacts/api-server/
COPY artifacts/prop-bet-portal/  ./artifacts/prop-bet-portal/

RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 · build — compile API bundle + Vite frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM deps AS build

# Build composite libs (api-spec → api-zod → api-client-react)
RUN pnpm run typecheck:libs

# API server — esbuild produces a fully self-contained bundle in dist/
RUN pnpm --filter @workspace/api-server run build

# Frontend — vite.config.ts requires PORT & BASE_PATH at eval time.
# PORT is only used by the dev server; BASE_PATH controls the asset prefix.
# For self-hosting at the root of a domain, BASE_PATH must be /.
ENV PORT=3000 BASE_PATH=/
RUN pnpm --filter @workspace/prop-bet-portal run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 · migrate — runs Drizzle schema push against the target database.
# This stage is used by the `migrate` service in docker-compose and exits
# after the push completes; the api service waits for it via depends_on.
# ─────────────────────────────────────────────────────────────────────────────
FROM deps AS migrate
CMD ["pnpm", "--filter", "@workspace/db", "run", "push-force"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 4 · api — minimal Node runtime, just the esbuild bundle (no node_modules)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS api
WORKDIR /app

COPY --from=build /app/artifacts/api-server/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "--enable-source-maps", "dist/index.mjs"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 5 · web — Nginx serves the React SPA and reverse-proxies /api
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS web

COPY --from=build /app/artifacts/prop-bet-portal/dist/public /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
