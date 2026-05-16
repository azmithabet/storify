#!/bin/sh
set -e

echo "→ Running master DB migrations..."
cd packages/database
npx prisma migrate deploy --schema=prisma/schema.prisma
cd ../..

echo "→ Starting server..."
exec node_modules/.bin/tsx apps/api/src/index.ts
