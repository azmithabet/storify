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
RUN pnpm --filter @storify/database db:generate

# Build the React frontend (output → apps/web/dist)
RUN pnpm --filter @storify/web build

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/
# No apps/web in production — only its built dist is needed

# Install all deps (tsx + prisma CLI are devDeps needed at runtime)
RUN pnpm install --frozen-lockfile

# Copy Prisma generated clients (gitignored, so must come from builder)
COPY --from=builder /app/packages/database/src ./packages/database/src
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

# Copy API source (tsx runs it directly — no compile step needed)
COPY --from=builder /app/apps/api/src ./apps/api/src
COPY --from=builder /app/apps/api/tsconfig.json ./apps/api/

# Copy built frontend
COPY --from=builder /app/apps/web/dist ./apps/web/dist

ENV NODE_ENV=production
EXPOSE 3000

# Run migrations then start server
CMD ["sh", "-c", "pnpm --filter @storify/database exec prisma migrate deploy --schema=prisma/schema.prisma && exec pnpm --filter @storify/api exec tsx apps/api/src/index.ts"]
