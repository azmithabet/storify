# حِسبة — Claude Code Starter Prompt

> انسخ الـ prompt ده وابعته لـ Claude Code في أول session

---

## الـ Prompt الكامل

```
You are a senior full-stack engineer working on "حِسبة" — a multi-tenant SaaS 
system for retail store and inventory management, built for the Arabic market.

## Project Overview
حِسبة is a B2B SaaS platform where each customer (tenant) gets their own isolated 
PostgreSQL schema. The system manages: POS sales, inventory, installment contracts, 
suppliers, expenses, and reports.

## Tech Stack (MUST follow exactly)
- **Monorepo:** pnpm workspaces
  - apps/api       → Fastify + TypeScript
  - apps/web       → React + Vite + TailwindCSS
  - packages/database → Prisma + PostgreSQL
  - packages/shared   → Shared TypeScript types
- **Backend:** Fastify 4.x + TypeScript (strict mode)
- **ORM:** Prisma 5.x with dynamic multi-schema support
- **Database:** PostgreSQL — Master DB + per-tenant schemas
- **Cache:** Redis (Upstash) via ioredis
- **Queue:** BullMQ for background jobs (PDF, SMS, Excel)
- **Storage:** Cloudflare R2 (S3-compatible)
- **Validation:** Zod for ALL inputs including env variables
- **Auth:** JWT Access Token (15min) + Refresh Token (7 days, HttpOnly Cookie)
- **Frontend:** React + Vite + TailwindCSS + TanStack Query + Zustand
- **Hosting:** Railway (API + DB) + Vercel (Frontend)

## Architecture Rules (CRITICAL)
1. **Multi-tenant isolation:** Every tenant has their own PostgreSQL schema 
   named `tenant_{slug}`. NEVER mix tenant data.
2. **Tenant Middleware:** Every API request must pass through tenant middleware 
   that resolves subdomain → tenant → schema → Prisma client.
3. **Feature Guards:** Plan features checked via middleware before routes.
4. **Financial Precision:** ALL monetary values use Prisma Decimal (DECIMAL(15,4)).
   NEVER use JavaScript floats for money. Use decimal.js for calculations.
5. **Zod validation:** Every request body, query params, and env variable 
   must be validated with Zod before use.
6. **Transactions:** Multi-step DB operations (create invoice + update stock + 
   create fee expense) MUST be wrapped in Prisma transactions.
7. **RTL/Arabic:** UI is Arabic RTL. dir="rtl" on html. Numbers are LTR inline.

## Database Architecture
### Master DB (hesba_master)
Tables: plans, tenants, subscriptions

### Tenant Schema (tenant_{slug})  
Tables (33+): branches, roles, users, products, categories, tax_rates,
stock, stock_movements, stock_transfers, customers, customer_documents,
payment_methods, invoices, invoice_items, returns, return_items,
installment_contracts, installment_payments, external_financing,
payment_fee_expenses, suppliers, supplier_transactions, purchase_orders,
purchase_order_items, purchase_receipts, purchase_payments,
expense_categories, expenses, currencies, coupons, product_discounts,
tenant_settings, offline_queue, print_templates

## Payment Methods & Fees (IMPORTANT)
Every payment method has configurable fees:
- fee_type: none | percentage | fixed | both
- fee_bearer: customer | merchant | negotiable
- When fee_bearer = merchant → auto-create payment_fee_expense record
- Formula: percentage → fee = total × (pct/100), fixed → fee = fee_fixed

## Key Business Rules
1. Installment contracts start as pending_approval — sale NOT complete until 
   manager approves (approved_by field set)
2. Stock updates happen inside invoice creation transaction
3. Payment fees auto-recorded as expenses when merchant bears them
4. exchange_rate_at_contract locked at contract creation time
5. Tenant info cached in Redis (5 min TTL)

## Roles (5 system roles, is_system=true, cannot be deleted)
super_admin, branch_manager, cashier, inventory_keeper, accountant
Permissions stored as JSONB: { "invoices": ["create", "read"], ... }

## Default Seed per new tenant
- 5 system roles with permissions
- 1 main branch
- tenant_settings (language: ar, timezone: Africa/Cairo)
- 6 payment methods (cash, visa, fawry, instapay, valu, bank_transfer)
- 2 tax rates (0%, 14%)
- 6 expense categories
- 1 currency (EGP, isBase: true)

## Design System
- Font: IBM Plex Sans Arabic (body) + JetBrains Mono (numbers)
- Primary: #6366F1 (Indigo 500)
- Success: #10B981 | Warning: #F59E0B | Danger: #EF4444
- Spacing: 4px base scale (sp-1=4px, sp-4=16px, sp-8=32px)
- Border radius: r-md=8px (buttons/inputs), r-xl=16px (cards/modals)
- All monetary values: font-mono + brand-700 color
- Badges always have dot OR icon (not color alone — accessibility)

## Folder Structure
apps/api/src/
├── config/        (env.ts, database.ts, redis.ts)
├── modules/       (auth, tenants, products, invoices, 
│                   installments, stock, customers, 
│                   suppliers, expenses, reports, payment-methods)
├── shared/
│   ├── middleware/ (tenant.ts, auth.ts, feature.ts)
│   ├── plugins/    (jwt, cors, helmet, rate-limit)
│   └── utils/      (password.ts, fee.ts, decimal.ts)
└── jobs/          (pdf.job.ts, excel.job.ts, sms.job.ts)

## API Response Format
Success: { success: true, data: {...}, meta?: { total, page, limit } }
Error:   { success: false, error: { code: string, message: string, details?: [] } }

## Current Status
- Step 01 ✅ COMPLETE: Project setup, folder structure, Docker, TypeScript config
- Step 02 🔄 IN PROGRESS: Master DB Schema + Prisma setup

## Your First Task
Complete Step 02:
1. Setup packages/database with Prisma
2. Create prisma/schema.prisma for Master DB (plans, tenants, subscriptions)
3. Run first migration: init_master_schema
4. Create seed file with 3 default plans (Starter 199/mo, Professional 499/mo, Enterprise 999/mo)
5. Connect @hesba/api to @hesba/database package
6. Add GET /plans and GET /health endpoints to verify everything works

Follow the exact schema defined above. Use cuid() for IDs in Master DB.
TypeScript strict mode. Zod for env validation.

When done, confirm with a status report showing:
- Files created
- Migration status  
- Seed data inserted
- Endpoints working
```

---

## بعد ما تبدأ Step 02 — ابعتله ده لـ Step 03

```
Step 02 is complete. Now implement Step 03: Multi-tenant Provisioning.

Create the tenant provisioning system:
1. getTenantDb(schemaName) function with client caching (Map<string, PrismaClient>)
2. runTenantMigrations(schemaName) — runs all tenant schema migrations
3. provisionTenant(data) — full flow:
   a. Create tenant in Master DB
   b. CREATE SCHEMA IF NOT EXISTS "tenant_{slug}"
   c. Run migrations on new schema
   d. Seed defaults (5 roles, 1 branch, settings, payment methods, currencies, etc.)
   e. Create owner as super_admin user (hashed password)
4. POST /api/tenants/register endpoint with Zod validation
5. Tenant middleware: subdomain → tenant → schema → Prisma client → Redis cache 5min
6. Feature guard middleware: check plan.features[feature] before routes

Test: Register a new tenant and verify schema + seed data created correctly.
```

---

## بعد ما تبدأ Step 04 — ابعتله ده لـ Step 04

```
Step 03 complete. Now implement Step 04: Authentication System.

1. POST /api/auth/login
   - Find user in tenant schema
   - Verify password (SHA-256 + salt)
   - Generate Access Token (15min) with payload:
     { userId, tenantId, schemaName, roleSlug, branchId, permissions }
   - Generate Refresh Token (7 days) → HttpOnly Cookie
   - Update last_login

2. POST /api/auth/refresh
   - Read refresh token from HttpOnly Cookie
   - Verify and issue new Access Token

3. POST /api/auth/logout
   - Clear HttpOnly Cookie

4. authenticate middleware — verify JWT on protected routes

5. requirePermission(resource, action) middleware

6. Frontend: axios interceptors for auto token refresh on 401

Test all auth flows including token expiry and refresh.
```

---

## نصائح مهمة لـ Claude Code

### 1. لو Claude Code طلب توضيح
قوله:
```
Follow the حِسبة architecture exactly as specified in the prompt. 
Use the exact table names, field names, and patterns defined above.
Do not deviate from the specified tech stack.
```

### 2. لو في error في الـ Migration
قوله:
```
Check the PostgreSQL connection and ensure hesba_master database exists.
Run: docker-compose up -d
Then retry the migration.
```

### 3. لو نسي حاجة
قوله:
```
Remember: ALL monetary values must use Prisma Decimal type (DECIMAL(15,4)).
ALL inputs must be validated with Zod.
ALL multi-step DB operations must use Prisma transactions.
```

### 4. Status Check بعد كل Step
```
Give me a full status report:
1. List all files created/modified
2. Show migration status (pnpm db:migrate status)
3. Show test results for all endpoints
4. Confirm no TypeScript errors (pnpm type-check)
5. What is the next step?
```

---

## ترتيب الـ Steps الكاملة

| Step | المهمة | الـ Prompt |
|---|---|---|
| 01 ✅ | Project Setup | مكتمل |
| 02 🔄 | Master DB + Prisma | الـ prompt الرئيسي أعلاه |
| 03 | Tenant Provisioning | prompt الـ Step 03 |
| 04 | Auth System | prompt الـ Step 04 |
| 05 | Tenant Schema (33+ tables) | اطلبه لما تخلص 04 |
| 06 | Core APIs (Products, Stock, Invoices) | اطلبه لما تخلص 05 |
| 07 | POS + Payment Fees | اطلبه لما تخلص 06 |
| 08 | Installments + Approval Flow | اطلبه لما تخلص 07 |
| 09 | Reports + Dashboard | اطلبه لما تخلص 08 |
| 10 | Frontend Foundation | اطلبه لما تخلص 09 |

---

## ملف .env المطلوب قبل البداية

```env
DATABASE_MASTER_URL="postgresql://postgres:password@localhost:5432/hesba_master"
REDIS_URL="redis://localhost:6379"
JWT_ACCESS_SECRET="hesba-access-secret-min-32-chars-here"
JWT_REFRESH_SECRET="hesba-refresh-secret-min-32-chars-here"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
NODE_ENV="development"
API_PORT=3000
API_HOST="0.0.0.0"
FRONTEND_URL="http://localhost:5173"
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_PUBLIC_URL=""
```

## قبل ما تبدأ — تأكد من الـ Docker

```bash
docker-compose up -d
docker-compose ps
# postgres healthy on 5432 ✅
# redis healthy on 6379 ✅
```

---

*حِسبة — Claude Code Starter Guide v1.0 — أبريل 2026*
