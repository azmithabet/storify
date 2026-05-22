FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install all dependencies (dev included — needed for build)
RUN pnpm install --frozen-lockfile

# ─── Build stage ─────────────────────────────────────────────────────────────
FROM deps AS builder

# Copy source
COPY packages ./packages
COPY apps ./apps

# Generate Prisma clients for master + tenant schemas
RUN pnpm --filter @hesba/database db:generate

# Build the React frontend (output → apps/web/dist)
RUN pnpm --filter @hesba/web build

# Compile the API to JS (output → apps/api/dist) and rewrite `@/` path aliases
# to relative paths so plain `node` can resolve them at runtime.
RUN pnpm --filter @hesba/api build

# ─── Production image ─────────────────────────────────────────────────────────
# Fresh stage with only production dependencies. tsx, eslint, vitest, and the
# TypeScript compiler are kept off the runner image because they only exist
# for build — smaller image, smaller attack surface.
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl tini && corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Workspace manifests (needed so pnpm can resolve workspace:* references)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/

# Production-only deps. db:seed and migrate-deploy invoke the prisma CLI, but
# we'll grab the prisma binary from the builder stage rather than re-installing
# it as a runtime dep.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Prisma generated clients (gitignored — must come from the builder stage)
COPY --from=builder /app/packages/database/src ./packages/database/src
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

# Tenant SQL migrations — runTenantMigrations() reads these at runtime
COPY --from=builder /app/packages/database/migrations ./packages/database/migrations

# Prisma CLI (a devDep) — copy the binary from the build stage so we can run
# `prisma migrate deploy` on startup without installing it as a runtime dep.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Seed script runs via tsx at startup; ship tsx alongside the seed source.
# Keeps the image small (one dev tool vs all of them).
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder /app/node_modules/.bin/tsx ./node_modules/.bin/tsx

# Compiled API code (no source, no tsconfig — plain Node serves dist/index.js)
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Built frontend (served statically by the API in production)
COPY --from=builder /app/apps/web/dist ./apps/web/dist

ENV NODE_ENV=production
EXPOSE 3000

# tini reaps zombies and forwards SIGTERM cleanly to Node so graceful-shutdown
# handlers fire during rolling deploys.
ENTRYPOINT ["/sbin/tini", "--"]

# Startup order:
#   1. prisma migrate deploy — applies any pending master-schema migrations
#   2. db:seed                — idempotent (upsert on slug)
#   3. node dist/index.js     — runs compiled JS; no tsx, no on-the-fly transpile
CMD ["sh", "-c", "pnpm --filter @hesba/database exec prisma migrate deploy --schema=prisma/schema.prisma && pnpm --filter @hesba/database db:seed && exec env API_PORT=${PORT:-3000} node apps/api/dist/index.js"]
