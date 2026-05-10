# Step 01 — Project Setup & Structure

> **الهدف:** إنشاء الـ monorepo structure الكاملة مع كل الـ configs جاهزة وصح من أول يوم.
> **الوقت المتوقع:** 30–45 دقيقة
> **المتطلبات:** Node.js 20+, pnpm, Git

---

## 1. التأكد من المتطلبات

```bash
node -v        # لازم 20.x أو أحدث
pnpm -v        # لازم 8.x أو أحدث
git --version  # أي version
```

لو pnpm مش موجود:
```bash
npm install -g pnpm
```

---

## 2. إنشاء الـ Monorepo

```bash
mkdir storify && cd storify
git init
pnpm init
```

> **ليه Monorepo؟**
> Backend وFrontend في نفس الـ repo — بيخليك تشارك الـ TypeScript types (زي response shapes) بين الاتنين من غير ما تعمل package منفصل. مع مشروع بيكتبه شخص واحد، ده أبسط وأذكى بكتير.

---

## 3. الـ Folder Structure الكاملة

شغّل الأوامر دي بالترتيب:

```bash
# الـ apps
mkdir -p apps/api/src/{config,modules,shared,types}
mkdir -p apps/api/src/modules/{auth,tenants,users}
mkdir -p apps/web/src

# الـ packages المشتركة
mkdir -p packages/shared/src/{types,utils,constants}
mkdir -p packages/database/src/{migrations,seeds}

# الـ infrastructure
mkdir -p infrastructure/docker

# الـ root config files
touch pnpm-workspace.yaml
touch .gitignore
touch .env.example
touch docker-compose.yml
```

---

## 4. شرح الـ Structure

```
storify/
│
├── apps/
│   ├── api/                        ← Fastify Backend
│   │   └── src/
│   │       ├── config/             ← env, database, redis configs
│   │       ├── modules/            ← كل feature في module منفصل
│   │       │   ├── auth/           ← login, refresh token, logout
│   │       │   ├── tenants/        ← إنشاء tenant جديد، provisioning
│   │       │   └── users/          ← إدارة المستخدمين
│   │       ├── shared/             ← middleware, hooks, plugins مشتركة
│   │       └── types/              ← TypeScript types خاصة بالـ API
│   │
│   └── web/                        ← React Frontend
│       └── src/
│
├── packages/
│   ├── shared/                     ← types وutils مشتركة بين api وweb
│   │   └── src/
│   │       ├── types/              ← Response types, DTOs
│   │       ├── utils/              ← helper functions مشتركة
│   │       └── constants/          ← roles, status values, إلخ
│   │
│   └── database/                   ← Prisma schema والـ migrations
│       └── src/
│           ├── migrations/         ← migration files
│           └── seeds/              ← seed data للـ testing
│
└── infrastructure/
    └── docker/                     ← Docker configs للـ local dev
```

> **ليه الـ modules pattern؟**
> بدل ما يبقى عندك folders زي `controllers/` و`services/` و`routes/` كلهم في نفس المستوى — كل feature عنده folder بيضم كل حاجة بتخصه. لما تشتغل على التقسيط مثلاً، كل حاجة محتاجها في مكان واحد.

---

## 5. ملف pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## 6. ملف .gitignore (الـ Root)

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Environment
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
.next/

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/settings.json
*.swp

# Prisma
*.db
*.db-journal

# Testing
coverage/
```

---

## 7. ملف .env.example (الـ Root)

```env
# ================================================
# DATABASE — Master DB (للـ tenants والـ plans)
# ================================================
DATABASE_MASTER_URL="postgresql://postgres:password@localhost:5432/storify_master"

# ================================================
# REDIS
# ================================================
REDIS_URL="redis://localhost:6379"

# ================================================
# JWT
# ================================================
JWT_ACCESS_SECRET="change-this-in-production-min-32-chars"
JWT_REFRESH_SECRET="change-this-too-in-production-min-32-chars"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# ================================================
# APP
# ================================================
NODE_ENV="development"
API_PORT=3000
API_HOST="0.0.0.0"
FRONTEND_URL="http://localhost:5173"

# ================================================
# STORAGE (Cloudflare R2)
# ================================================
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_PUBLIC_URL=""

# ================================================
# EMAIL (Resend)
# ================================================
RESEND_API_KEY=""
EMAIL_FROM="noreply@yourdomain.com"
```

---

## 8. إعداد الـ API Package

### 8.1 إنشاء package.json للـ API

```bash
cd apps/api
pnpm init
```

افتح الملف وحط المحتوى ده:

```json
{
  "name": "@storify/api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "fastify": "^4.26.2",
    "@fastify/cors": "^9.0.1",
    "@fastify/helmet": "^11.1.1",
    "@fastify/jwt": "^8.0.1",
    "@fastify/cookie": "^9.3.1",
    "@fastify/multipart": "^8.1.0",
    "@fastify/rate-limit": "^9.1.0",
    "@prisma/client": "^5.10.2",
    "bullmq": "^5.4.2",
    "ioredis": "^5.3.2",
    "zod": "^3.22.4",
    "dotenv": "^16.4.5",
    "@aws-sdk/client-s3": "^3.525.0",
    "dayjs": "^1.11.10",
    "nanoid": "^5.0.6"
  },
  "devDependencies": {
    "typescript": "^5.4.2",
    "tsx": "^4.7.1",
    "prisma": "^5.10.2",
    "@types/node": "^20.11.24"
  }
}
```

### 8.2 تثبيت الـ dependencies

```bash
# من جوه apps/api
pnpm install
```

---

## 9. TypeScript Config للـ API

أنشئ ملف `apps/api/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

> **ليه strict: true؟**
> بيلزمك تكتب types صريحة لكل حاجة — في البداية ممكن تزعلك شوية، لكن بيحمي المشروع من bugs كتير خصوصاً في الحسابات المالية والـ multi-tenant logic.

---

## 10. إنشاء ملف الـ Entry Point

أنشئ `apps/api/src/index.ts`:

```typescript
import Fastify from 'fastify'
import { config } from './config/env'

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'info' : 'warn',
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
})

const start = async () => {
  try {
    await app.listen({ port: config.API_PORT, host: config.API_HOST })
    console.log(`Server running on port ${config.API_PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
```

---

## 11. Config — Environment Variables

أنشئ `apps/api/src/config/env.ts`:

```typescript
import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config({ path: '../../.env' })

// Schema بيتحقق من كل الـ env variables عند البداية
const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().url(),

  // Database
  DATABASE_MASTER_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Storage
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data
```

> **ليه Zod للـ env validation؟**
> بدل ما تلاقي error غريب وقت الـ runtime، النظام بيوقف فوراً عند البداية ويقولك بالظبط إيه الـ env variable الناقص أو الغلط. ده بيوفر وقت debug كتير.

---

## 12. Docker Compose للـ Local Development

أنشئ `docker-compose.yml` في الـ root:

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: storify_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: storify_master
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: storify_redis
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

تشغيل الـ local services:

```bash
# من الـ root
docker-compose up -d

# التأكد إنهم شغالين
docker-compose ps
```

---

## 13. إعداد الـ Root package.json

افتح `package.json` في الـ root وعدّله:

```json
{
  "name": "storify",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev:api": "pnpm --filter @storify/api dev",
    "dev:web": "pnpm --filter @storify/web dev",
    "build": "pnpm --filter @storify/api build && pnpm --filter @storify/web build",
    "lint": "pnpm -r lint",
    "type-check": "pnpm -r type-check",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down"
  }
}
```

---

## 14. التأكد إن كل حاجة شغالة

```bash
# 1. شغّل الـ services
docker-compose up -d

# 2. شغّل الـ API
cd apps/api
pnpm dev
```

المفروض تشوف:
```
Server running on port 3000
```

لو في error في الـ env variables هتشوف رسالة واضحة زي:
```
❌ Invalid environment variables:
{ DATABASE_MASTER_URL: ['Invalid url'] }
```

---

## 15. Git — أول Commit

```bash
# من الـ root
git add .
git commit -m "chore: initial project setup

- monorepo structure with pnpm workspaces
- fastify api boilerplate with typescript
- zod env validation
- docker-compose for local postgres and redis
- folder structure for multi-tenant architecture"
```

---

## Checklist — قبل ما تنتقل للـ Step 2

- [ ] الـ folder structure اتعملت صح
- [ ] `pnpm install` اشتغل بدون errors
- [ ] `docker-compose up -d` شغّل postgres وredis
- [ ] `pnpm dev` شغّل الـ server على port 3000
- [ ] أول commit اتعمل على GitHub

---

## الخطوة الجاية — Step 02

**Master DB Schema + Prisma Setup**

هنعمل:
- تثبيت وإعداد Prisma
- Schema للـ Master DB (tenants, plans, subscriptions)
- أول migration
- Seed data للـ plans الافتراضية (Starter, Professional, Enterprise)
