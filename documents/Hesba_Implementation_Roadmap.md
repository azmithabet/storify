# حِسبة — Implementation Roadmap v1.2 (for Claude Code)
> **The single master execution plan.** Every other doc is a reference; this is the order of operations.
> **Date:** 2026-05-10 | **Phase 1 target:** ~4 months | **Spec frozen at:** v1.2

---

## 0. How Claude Code uses this document

This roadmap is **executable, not aspirational**. Every step has:
- **Goal** — one sentence
- **Read first** — exact files Claude Code must load before coding
- **Tasks** — numbered, actionable
- **Verify** — exact commands that must pass
- **Done when** — binary checklist; no "mostly done"
- **Commit message**

Rules:
1. **Never skip the "Read first" section.** Reading docs is part of the step, not optional.
2. **Never start step N+1 until step N's `Done when` checklist is 100% green.**
3. **If reality differs from spec, stop and ask** — do not silently improvise.
4. **Every commit message starts with the step number** (e.g., `feat(step02): ...`).
5. **Run `pnpm type-check` and `pnpm test` before every commit** once the test infrastructure exists (Step 02+).

---

## 1. Session protocol (every session)

At the start of every Claude Code session:
1. Read this file (`documents/Hesba_Implementation_Roadmap.md`)
2. Find the next step where `Done when` is not all green
3. Read that step's "Read first" docs
4. Execute the step's Tasks
5. Run Verify commands
6. Update the `Done when` checklist in this file (mark `[x]` for completed items)
7. Commit
8. Move to the next step

**Never load all docs at once.** Load only what the current step needs to keep context tight.

---

## 2. Document hierarchy (canonical sources)

| Doc | When to read |
|---|---|
| **`documents/Hesba_Implementation_Roadmap.md`** (this file) | Always, at session start |
| **`documents/Markdown/Hesba_Patch_Notes_v1.2.md`** | Always, at session start |
| `documents/Claude_Code/HESBA_COMPLETE_CONTEXT.md` | Primary technical reference — schema, middleware, code patterns |
| `documents/Markdown/Hesba_Logic_Flow_Document.md` | Before implementing a business flow (POS, installments, returns) |
| `documents/Markdown/Hesba_Design_System.md` | Before any UI work — tokens, components, RTL rules |
| `documents/Markdown/Hesba_ERD_Document.md` | When designing Prisma models — table-by-table reference |
| `documents/Markdown/Hesba_Payment_Fees_Update.md` | Step 07 only — fee calculation deep dive |
| `documents/Markdown/Hesba_Technical_Architecture.md` | Reference only — architectural decisions explained |
| `documents/Markdown/Hesba_Business_Document.md` | Reference only — pricing, market context |
| `documents/Claude_Code/HESBA_MASTER_DOCUMENT.md` | Reference only — older v1.0 doc, superseded by COMPLETE_CONTEXT v1.2 |

**Conflict resolution:** if two docs disagree, `Hesba_Patch_Notes_v1.2.md` wins, then `HESBA_COMPLETE_CONTEXT.md` v1.2.

---

## 3. Pre-flight checklist (one-time, before Step 01)

### Tooling
- [ ] Node.js 20.x+ installed (`node -v`)
- [ ] pnpm 8.x+ installed (`pnpm -v`)
- [ ] Docker Desktop running (`docker -v`)
- [ ] Git installed (`git --version`)
- [ ] PostgreSQL CLI installed (`psql --version`) — optional but useful

### External accounts (can be deferred to specific steps)
- [ ] **GitHub repo created** (private) — needed before first commit (Step 01)
- [ ] **Cloudflare account** — DNS + R2 — needed Step 06 (image upload)
- [ ] **Resend account** — email — needed Step 04 (password reset email)
- [ ] **Paymob merchant account (sandbox)** — needed Step 09b
- [ ] **ETA preprod account + activity code + signing certificate** — needed Step 09a
- [ ] **Railway account** — deployment — needed at end of Phase 1
- [ ] **Vercel account** — frontend deployment — end of Phase 1

### Spec sign-off
- [x] v1.2 patches applied to docs
- [x] D1 ETA full integration confirmed
- [x] D2 Paymob confirmed
- [ ] User has read `Hesba_Patch_Notes_v1.2.md` end-to-end

---

## 4. The Roadmap

Phase 1 has **17 steps** organized in 3 tracks:
- **Backbone (01–05):** monorepo, master DB, multi-tenant, auth, tenant schema
- **Core APIs (06–10):** business modules
- **Compliance + Frontend (09a, 09b, 11–13):** ETA, Paymob, then UI

---

### Step 01 — Project Setup (monorepo + Docker + TypeScript)

**Goal:** Stand up the monorepo so subsequent steps have a place to put code.
**Estimated time:** 30–45 minutes.

**Read first:**
- `documents/Claude_Code/STEP_01_PROJECT_SETUP.md` (the existing detailed walkthrough)
- `documents/Claude_Code/HESBA_COMPLETE_CONTEXT.md` Section 13 (Folder Structure)
- `documents/Claude_Code/HESBA_MASTER_DOCUMENT.md` Step 01 (package.json deps — note v1.2 additions: `bcryptjs`, `decimal.js`, `lru-cache`, `@types/bcryptjs`)

**Tasks:**
1. Create folder structure per Section 13 (`apps/api`, `apps/web`, `packages/database`, `packages/shared`, `infrastructure/docker`)
2. `pnpm-workspace.yaml` — list `apps/*`, `packages/*`
3. Root `package.json` with scripts (`dev:api`, `dev:web`, `docker:up`, `db:migrate`, `db:seed`, `type-check`)
4. Root `.gitignore` — node_modules, .env, dist, .DS_Store, coverage
5. Root `tsconfig.base.json` — strict mode, ES2022, paths
6. `apps/api/package.json` with v1.2 deps (Fastify + Prisma + bcryptjs + decimal.js + lru-cache + zod + bullmq + ioredis)
7. `apps/api/tsconfig.json` extending base
8. `apps/api/src/index.ts` — Fastify boot with `/health` endpoint
9. `apps/api/src/config/env.ts` — Zod env validation including Paymob + ETA + APP_ENCRYPTION_KEY (already in `.env`)
10. `docker-compose.yml` — postgres:16 + redis:7 with healthchecks
11. `pnpm install` from root
12. `docker-compose up -d` — verify PG + Redis healthy
13. `pnpm dev:api` — verify `/health` returns `{ status: 'ok' }`

**Verify:**
```bash
docker-compose ps           # postgres + redis: healthy
pnpm dev:api &              # background
sleep 3
curl http://localhost:3000/health   # {"status":"ok",...}
pnpm type-check             # zero errors
```

**Done when:**
- [x] Folder structure matches COMPLETE_CONTEXT Section 13
- [x] `pnpm install` completes with no errors
- [x] Docker postgres + redis both `healthy`
- [x] `GET /health` returns 200
- [x] `pnpm type-check` passes
- [ ] First git commit pushed to remote

**Commit:** `chore(step01): monorepo scaffold with fastify, prisma deps, docker compose`

---

### Step 02 — Master DB Schema + Prisma

**Goal:** Master DB tables (plans, tenants, subscriptions, payment_attempts) created and seeded.

**Read first:**
- `documents/Claude_Code/HESBA_COMPLETE_CONTEXT.md` Sections 4 (Master DB schema) + 15 (Plans seed)
- `documents/Markdown/Hesba_Patch_Notes_v1.2.md` (tenants field naming, max_users=3, payment_attempts table)

**Tasks:**
1. `cd packages/database && pnpm init`
2. Add Prisma deps + scripts (`db:migrate`, `db:generate`, `db:seed`, `db:studio`, `db:reset`)
3. Write `prisma/schema.prisma` for **Master DB only** (4 models):
   - `Plan` (cuid, slug unique, JSONB features)
   - `Tenant` (cuid, **subdomain** unique, **schema_name** unique, **schema_version** INT default 0, status enum incl. SUSPENDED, suspended_at, cancelled_at)
   - `Subscription` (cuid, status incl. SUSPENDED, all Paymob fields: provider, provider_subscription_id, provider_customer_id, provider_card_token, last_payment_at, next_billing_at, failed_attempts, last_failure_reason)
   - `PaymentAttempt` (cuid, FK→subscription, provider_transaction_id unique, status enum, attempt_type)
4. Generator output to `../src/generated/client`
5. Singleton client `packages/database/src/prisma.ts`
6. Run `pnpm db:migrate --name init_master_schema`
7. Seed file `packages/database/src/seeds/master.seed.ts` with 3 plans (Starter 199 EGP / Pro 499 / Enterprise 999) — **max_users: 3** for Starter
8. Run `pnpm db:seed`
9. Wire `apps/api` to `@hesba/database` workspace dep
10. Add `GET /plans` to API returning seeded plans

**Verify:**
```bash
pnpm db:migrate status      # init_master_schema applied
psql $DATABASE_MASTER_URL -c '\d plans'        # 3 columns + features JSONB
curl http://localhost:3000/plans                # 3 plans returned
```

**Done when:**
- [x] 4 master tables exist in PG
- [x] 3 plans seeded with correct `max_users` (Starter=3)
- [x] `subscriptions.status` accepts SUSPENDED
- [x] `tenants.schema_version` defaults to 0
- [x] `payment_attempts.provider_transaction_id` is UNIQUE
- [x] `GET /plans` returns the 3 plans
- [x] `pnpm type-check` passes

**Commit:** `feat(step02): master db schema with plans, tenants, subscriptions, payment_attempts`

---

### Step 03 — Tenant Provisioning + Middleware

**Goal:** Can create a new tenant via API; tenant middleware resolves subdomain → schema → req.tenantDb.

**Read first:**
- `documents/Claude_Code/HESBA_COMPLETE_CONTEXT.md` Section 5 (Multi-tenant — tenant middleware, LRU cache, provisioning, migration runner)
- `documents/Markdown/Hesba_Logic_Flow_Document.md` Flow 1 (tenant registration)

**Tasks:**
1. `apps/api/src/config/database.ts` — `masterDb` + `getTenantDb()` using **LRU cache (max:50, ttl:30min)** with dispose disconnects pool
2. `apps/api/src/config/redis.ts` — ioredis client
3. `packages/database/migrations/tenant/001_init.sql` — empty for now (Step 05 fills it)
4. `packages/database/src/migrate-tenants.ts` — `runTenantMigrations(schemaName, tenantId)` + `migrateAllTenants()`
5. `apps/api/src/shared/middleware/tenant.middleware.ts` — uses `subdomain` + `schemaName`, Redis cache 5 min
6. `apps/api/src/shared/middleware/feature.middleware.ts` — `requireFeature(feature)` reads `tenant.plan.features`
7. `apps/api/src/modules/tenants/tenant.service.ts` — `provisionTenant({ name, subdomain, planId, ownerName, ownerEmail, ownerPassword })`. Creates tenant row, runs `CREATE SCHEMA`, runs migrations, sets schema_version, status → ACTIVE.
8. `apps/api/src/modules/tenants/tenant.routes.ts` — `POST /api/tenants/register` with Zod schema
9. Local hosts entry: `127.0.0.1 test-store.localhost` (or use `Host:` header in tests)

**Verify:**
```bash
curl -X POST http://localhost:3000/api/tenants/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Store","subdomain":"test-store","planSlug":"starter",
       "ownerName":"Owner","ownerEmail":"o@test.com","ownerPassword":"changeme123"}'
# 201 + { subdomain: "test-store", loginUrl: "..." }

psql $DATABASE_MASTER_URL -c "SELECT subdomain, schema_name, schema_version, status FROM tenants;"
# test-store | tenant_test_store | 0 | ACTIVE  (schema_version=0 because tenant migrations are no-op in step 3)

psql $DATABASE_MASTER_URL -c "\dn tenant_test_store"   # schema exists
```

**Done when:**
- [ ] `POST /api/tenants/register` creates tenant + schema atomically
- [ ] Master row uses `subdomain` and `schema_name` (not `slug`/`db_name`)
- [ ] `getTenantDb()` uses `LRUCache`, not unbounded `Map`
- [ ] Tenant middleware sets `req.tenantDb` correctly
- [ ] Duplicate subdomain returns 409
- [ ] Invalid subdomain regex (`^[a-z0-9-]+$`) returns 400
- [ ] `pnpm type-check` passes

**Commit:** `feat(step03): tenant provisioning with LRU client cache and migration runner`

---

### Step 04 — Auth System (login, refresh, logout, password reset)

**Goal:** JWT auth working end-to-end; password reset functional with email.

**Read first:**
- `documents/Claude_Code/HESBA_COMPLETE_CONTEXT.md` Section 6 (full Auth section incl. v1.2 bcrypt + password reset flow)
- `documents/Markdown/Hesba_Logic_Flow_Document.md` Flow 2 (login)

**Tasks:**
1. `apps/api/src/shared/utils/password.ts` — **bcryptjs** (cost 12) — NOT SHA-256
2. `apps/api/src/shared/utils/encryption.ts` — AES-256-GCM helpers using `APP_ENCRYPTION_KEY` (used later for ETA secrets)
3. `apps/api/src/shared/plugins/jwt.plugin.ts` — `@fastify/jwt` configured for access + refresh
4. `apps/api/src/shared/plugins/cookie.plugin.ts` — `@fastify/cookie` for HttpOnly refresh
5. `apps/api/src/shared/middleware/auth.middleware.ts` — `authenticate`, `requirePermission(resource, action)` (super_admin bypasses)
6. `apps/api/src/modules/auth/auth.service.ts`:
   - `loginUser(schemaName, email, password)` — verify password, return access + refresh
   - `refreshAccessToken(refreshToken)`
   - `requestPasswordReset(db, email, ip)` — always 200, generate token, hash, email
   - `resetPassword(db, rawToken, newPassword)`
7. `apps/api/src/modules/auth/auth.routes.ts`:
   - `POST /api/auth/login`
   - `POST /api/auth/refresh`
   - `POST /api/auth/logout`
   - `POST /api/auth/forgot-password`
   - `POST /api/auth/reset-password`
8. Rate limiting:
   - login: 10/min/IP
   - forgot-password: 5/hour/email (Redis-backed)
9. Email helper `apps/api/src/shared/utils/email.ts` — Resend client; template `password_reset.html` (Arabic, RTL)

**Verify:**
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -H 'Host: test-store.localhost' \
  -d '{"email":"o@test.com","password":"changeme123"}'
# { accessToken, user: {...} }  + Set-Cookie: refreshToken=...; HttpOnly

# Bad password
curl ... -d '{"email":"o@test.com","password":"wrong"}'
# 401 invalid_credentials

# Forgot password (always 200)
curl -X POST .../api/auth/forgot-password -d '{"email":"o@test.com"}'
curl -X POST .../api/auth/forgot-password -d '{"email":"nobody@x.com"}'
# both return 200 — no enumeration
```

**Done when:**
- [ ] Login returns access token + refresh cookie (HttpOnly, Secure, SameSite=Lax)
- [ ] Bcrypt is the hashing algorithm in `users.password_hash`
- [ ] Refresh endpoint issues new access token
- [ ] Logout clears the cookie
- [ ] Forgot-password always returns 200 (no email enumeration)
- [ ] Reset-password rejects expired tokens, used tokens, wrong tokens
- [ ] Rate limit on forgot-password: 5/hour/email returns 429 on 6th attempt
- [ ] Email actually sent in dev mode (or logged with token visible)
- [ ] `pnpm type-check` passes

**Commit:** `feat(step04): jwt auth with bcrypt and password reset flow`

---

### Step 05 — Tenant Schema (all 34 tables)

**Goal:** Every tenant gets all 34 tenant tables, including v1.2 additions and ETA fields.

**Read first:**
- `documents/Claude_Code/HESBA_COMPLETE_CONTEXT.md` Section 4 (every tenant table)
- `documents/Markdown/Hesba_ERD_Document.md` v1.2 update section (variant FK redirections, ETA fields, audit_logs, password_reset_tokens, eta_submissions)

**Tasks:**
1. **Decision:** dual-schema strategy. Master DB = `packages/database/prisma/schema.prisma`. Tenant tables = `packages/database/prisma/schema.tenant.prisma` (separate schema with `multiSchema` preview feature). Generator outputs both clients.
2. Write `schema.tenant.prisma` with ALL 34 tenant models from COMPLETE_CONTEXT Section 4. Critical:
   - `tenant_settings` includes 10 ETA fields
   - `invoices` includes 9 ETA tracking fields
   - `eta_submissions` table
   - `product_variants` table; FKs from stock/movements/transfer_items/invoice_items/return_items/purchase_order_items go to `variant_id`
   - `audit_logs` table
   - `password_reset_tokens` table
   - `payment_methods` + `payment_fee_expenses` (v1.1)
3. Convert schema → SQL migration: `packages/database/migrations/tenant/001_init.sql` (use `prisma migrate diff` or hand-write)
4. Update `packages/database/src/migrate-tenants.ts` to apply 001 to existing tenants
5. Update `seedTenantDefaults()` in tenant service:
   - 5 system roles with permissions JSONB
   - 1 main branch (named after the tenant)
   - tenant_settings (lang=ar, timezone=Africa/Cairo, eta_enabled=false)
   - 1 EGP currency (isBase=true)
   - 2 tax rates (0%, 14%)
   - 6 expense categories
   - 6 payment methods (cash, visa 1.75%, fawry/فلوسة 2 EGP fixed, instapay 0%, valu 3%, bank_transfer 5 EGP fixed)
   - 1 super_admin user with bcrypt-hashed password
   - **For products seeded later:** every product gets at least one auto-default variant with `attributes={}`
6. Re-provision a tenant and verify all 34 tables exist with seed data

**Verify:**
```bash
# Wipe and re-provision
pnpm db:reset     # if you have one; otherwise drop schema + re-register
curl -X POST .../api/tenants/register -d '{...}'
psql $DATABASE_MASTER_URL -c "\dt tenant_test_store.*"
# Should list 34 tables

psql ... -c "SELECT count(*) FROM tenant_test_store.roles;"           # 5
psql ... -c "SELECT count(*) FROM tenant_test_store.payment_methods;" # 6
psql ... -c "SELECT count(*) FROM tenant_test_store.users;"           # 1
```

**Done when:**
- [ ] All 34 tenant tables created (including `eta_submissions`, `product_variants`, `audit_logs`, `password_reset_tokens`)
- [ ] Stock/movements/transfer_items/invoice_items/return_items/purchase_order_items all FK to `variant_id`
- [ ] Seed creates 5 roles, 6 payment methods, 1 EGP currency, 2 tax rates, 6 expense categories, 1 super_admin
- [ ] Provisioning a new tenant takes < 5 seconds
- [ ] `pnpm type-check` passes

**Commit:** `feat(step05): full tenant schema with v1.2 additions and ETA fields`

---

### Step 06 — Products + Variants + Stock APIs

**Goal:** Products with variants, stock per branch, stock movements, low-stock alerts.

**Read first:**
- `documents/Markdown/Hesba_Logic_Flow_Document.md` Flow 6 (stock management)
- `documents/Markdown/Hesba_Logic_Flow_Document.md` Flow 7 (stock transfers)
- COMPLETE_CONTEXT Section 4 (products + variants + stock + stock_movements + stock_transfers)

**Tasks:**
1. R2/S3 client setup `apps/api/src/config/r2.ts` (image upload)
2. `apps/api/src/modules/products/`:
   - `product.routes.ts` + `product.schema.ts` (Zod)
   - `GET/POST /api/products` with pagination + search
   - `GET/PATCH/DELETE /api/products/:id`
   - `POST /api/products/:id/variants` — add variant
   - `PATCH /api/products/variants/:variantId`
   - `GET /api/products/barcode/:code` — barcode lookup → returns variant
   - On product create: if `has_variants=false`, auto-create one default variant
3. `apps/api/src/modules/stock/`:
   - `GET /api/stock` — current per branch
   - `PATCH /api/stock/:variantId` — manual adjustment with reason (writes stock_movement + audit_log)
   - `GET /api/stock/movements`
   - `POST /api/stock/transfers` + `PATCH /api/stock/transfers/:id/approve`
4. Audit log helper: `auditLog(db, { actorId, entity, entityId, action, before, after })` — used by all mutating endpoints
5. Image upload utility: signed URL generation; client uploads directly to R2

**Verify:**
```bash
# Create product without variants
curl -X POST .../api/products -d '{"name":"T-shirt", "categoryId":"...", "taxRateId":"...", "variants":[{"sku":"TS-001","barcode":"100001","costPrice":50,"sellPrice":100}]}'
# 201, has_variants=false, 1 default variant returned

# Create product WITH variants (size + color)
curl ... -d '{"name":"Polo", "hasVariants":true, "variants":[
  {"sku":"P-S-RED","attributes":{"size":"S","color":"red"},"costPrice":80,"sellPrice":150,"barcode":"200001"},
  {"sku":"P-L-RED","attributes":{"size":"L","color":"red"},"costPrice":80,"sellPrice":150,"barcode":"200002"}
]}'

# Barcode scan
curl .../api/products/barcode/100001    # returns variant + parent product
```

**Done when:**
- [ ] Product CRUD works
- [ ] Variant CRUD works
- [ ] Single-variant products auto-create default variant
- [ ] Barcode lookup returns variant
- [ ] Stock per branch + manual adjustment works
- [ ] Stock transfer flow (pending → approved → completed)
- [ ] Every mutating endpoint writes an audit_log row
- [ ] Low-stock alert flagged when `quantity <= min_quantity`
- [ ] `pnpm type-check` passes

**Commit:** `feat(step06): products, variants, stock with audit logging`

---

### Step 07 — POS + Invoices + Payment Fees + Returns

**Goal:** Complete POS sale lifecycle including fee calculation, atomic stock locking, and returns.

**Read first:**
- `documents/Markdown/Hesba_Payment_Fees_Update.md` (full doc)
- `documents/Markdown/Hesba_Logic_Flow_Document.md` Flow 3 (cash/card sale) + Flow 8 (returns) + Flow 13 (fees)
- COMPLETE_CONTEXT Section 7 (payment fees) + Section 10 (invoice creation v1.2 atomic flow)

**Tasks:**
1. `apps/api/src/shared/utils/decimal.ts` — wrapper around `decimal.js` for money math
2. `apps/api/src/shared/utils/fee.ts` — `calculateFee(total, paymentMethod)` exactly per Section 7
3. `apps/api/src/modules/payment-methods/` — full CRUD
4. `apps/api/src/modules/customers/` — full CRUD + `POST /api/customers/:id/documents` (R2 upload for ID images)
5. `apps/api/src/modules/invoices/`:
   - **`createInvoice` uses the v1.2 atomic flow:** stock decrement via `updateMany` with `quantity: { gte: n }` inside transaction; throw on `result.count === 0`
   - Auto-create `payment_fee_expenses` when `fee_bearer === 'merchant'`
   - Audit log inside the transaction
   - Coupon validation + usage increment
   - `GET /api/invoices` (paginated, filterable by date/customer/status)
   - `GET /api/invoices/:id`
   - `POST /api/invoices/:id/return` — refund OR credit (writes returns + return_items + stock_movement if restock=true; updates `customers.credit_balance` if credit)
6. PDF generation for invoices (use `@react-pdf/renderer` or Puppeteer in BullMQ job)

**Verify:**
```bash
# Sale with merchant-bearing fee (Visa 1.75%)
curl -X POST .../api/invoices -d '{
  "branchId":"...", "paymentMethodId":"...visa...",
  "items":[{"variantId":"...","quantity":1,"unitPrice":100}]
}'
# total_amount = 100 (fee not added because merchant bears it)
# payment_fee_expenses row created with fee_amount = 1.75

# Sale with customer-bearing fee
curl ... # toggle fee_bearer = customer
# total_amount = 101.75 (fee added to total)
# no payment_fee_expense

# Race-safe stock: try to sell 2 of an item with stock=1 in two parallel requests
# Only one should succeed; other gets insufficient_stock
```

**Done when:**
- [ ] Invoice creation is atomic — stock check INSIDE transaction with `updateMany ... gte: n`
- [ ] Insufficient stock returns 400 + `insufficient_stock:{variantId}` and rolls back the invoice
- [ ] Fee calculated correctly for percentage / fixed / both / none
- [ ] Merchant-bearing fees auto-create `payment_fee_expenses`
- [ ] Customer-bearing fees added to `total_amount`
- [ ] Audit log written for invoice create + return
- [ ] Returns flow: refund debits cash, credit increments `customers.credit_balance`
- [ ] Coupon validation (date + max_uses) + increment on use
- [ ] PDF invoice rendered with Arabic RTL + ETA QR placeholder (filled in Step 09a)
- [ ] `pnpm type-check` passes

**Commit:** `feat(step07): pos invoices with atomic stock locking and fee handling`

---

### Step 08 — Installments (internal + external)

**Goal:** Installment contracts with manager approval gate and external financing.

**Read first:**
- `documents/Markdown/Hesba_Logic_Flow_Document.md` Flow 4 (internal installments) + Flow 5 (external)
- COMPLETE_CONTEXT Section 8 (installment system)

**Tasks:**
1. `apps/api/src/modules/installments/`:
   - `POST /api/installments` — create contract with status `pending_approval`. **Stock NOT updated yet.** Invoice created with `status='pending'`. Customer national ID + signature uploaded to R2.
   - `PATCH /api/installments/:id/approve` — atomic transaction: status→active, invoice→completed, decrement stock (atomic), generate `installment_payments` schedule, audit log. Requires `installments:approve` permission.
   - `PATCH /api/installments/:id/reject` — status→cancelled, invoice→cancelled
   - `POST /api/installments/:id/payment` — record installment payment, update status (paid/overdue), audit log
   - `GET /api/installments` (paginated, filterable)
2. Exchange rate locking: at contract creation, copy `currencies.rate_to_base` to `installment_contracts.exchange_rate_at_contract`
3. External financing: `POST /api/invoices` with `payment_method_id = bnpl method`; persist `external_financing` row with company_name + reference_no + commission_pct
4. PDF contract generation (BullMQ job) — A4, Arabic RTL, signature image

**Verify:**
```bash
# Create installment contract
curl -X POST .../api/installments -d '{
  "items":[...], "customerId":"...", "downPayment":500,
  "installmentsCount":12, "firstDueDate":"2026-06-01", "interestRate":0
}'
# 201, status: pending_approval, invoice.status=pending, stock unchanged

# Manager approves
curl -X PATCH .../api/installments/:id/approve -H 'Authorization: Bearer {manager_token}'
# 200, status:active, invoice.status:completed, stock decremented atomically, 12 payments scheduled

# Cashier (no approve permission) tries
curl ... -H 'Authorization: Bearer {cashier_token}'
# 403 forbidden
```

**Done when:**
- [ ] Internal contract created with status `pending_approval` — stock not touched
- [ ] Approve transitions to `active`, decrements stock atomically, generates payment schedule
- [ ] Reject transitions to `cancelled`
- [ ] Permission `installments:approve` enforced
- [ ] External financing stored separately
- [ ] Exchange rate locked at contract time
- [ ] Audit logs for create / approve / reject / payment
- [ ] Contract PDF generated and uploaded to R2

**Commit:** `feat(step08): installment contracts with approval gate and rate locking`

---

### Step 09 — Suppliers + Purchase Orders + Expenses

**Goal:** Procurement and expense tracking complete.

**Read first:**
- `documents/Markdown/Hesba_Logic_Flow_Document.md` Flow 9 (suppliers + purchases) + Flow 10 (expenses)
- COMPLETE_CONTEXT Section 4 (suppliers, purchase_orders, purchase_order_items, purchase_receipts, purchase_payments, expenses, expense_categories)

**Tasks:**
1. Suppliers module: full CRUD + `supplier_transactions` (payment / purchase / return) — updates `suppliers.balance`
2. Purchase orders module:
   - `POST /api/purchase-orders` (status=draft)
   - `PATCH /api/purchase-orders/:id/submit` (draft→pending)
   - `PATCH /api/purchase-orders/:id/approve` (pending→approved)
   - `POST /api/purchase-orders/:id/receive` — atomic: increment stock per variant, write stock_movements, create purchase_receipt, update PO status to received
   - `POST /api/purchase-orders/:id/payments` — partial or full payment
3. Expenses module: full CRUD + approval flow (`pending → approved/rejected`); `payment_fee_expenses` show up in expenses report

**Verify:**
```bash
# Receive PO → stock increases
curl ... PATCH approve, then POST receive
psql ... SELECT quantity FROM stock WHERE variant_id=...   # incremented
psql ... SELECT * FROM stock_movements WHERE type='in' AND reference=:po_id   # logged
```

**Done when:**
- [ ] Supplier CRUD + balance tracking
- [ ] PO lifecycle: draft → pending → approved → received
- [ ] Receiving PO atomically increments stock per variant
- [ ] Partial payments to PO work; supplier balance updated
- [ ] Expense create + approval flow
- [ ] Audit logs throughout

**Commit:** `feat(step09): suppliers, purchase orders, expenses with approvals`

---

### Step 09a — ETA E-Invoicing Integration (~3 weeks)

**Goal:** Every invoice automatically submitted to Egyptian Tax Authority. QR code on receipt.

**Prerequisites (must obtain BEFORE starting):**
- [ ] ETA preprod portal account (حِسبة owner)
- [ ] At least one tenant's: `eta_taxpayer_id` (RIN), `eta_activity_code`, `client_id`, `client_secret`
- [ ] Digital signing certificate (USB token recommended for first deploy)
- [ ] Read ETA's official "SDK Developer Manual" — JSON canonical format spec

**Read first:**
- `documents/Claude_Code/HESBA_COMPLETE_CONTEXT.md` Step 09a section
- ETA's official API docs: https://sdk.preprod.invoicing.eta.gov.eg
- COMPLETE_CONTEXT — `tenant_settings` ETA fields, `invoices` ETA fields, `eta_submissions` table

**Tasks:**
1. `apps/api/src/modules/eta/eta.client.ts` — JWT auth with ETA, token refresh
2. `apps/api/src/modules/eta/eta.payload.ts` — build canonical JSON from invoice + items + customer + tenant_settings (validate tax breakdown precisely; ETA is strict about decimals and rounding)
3. `apps/api/src/modules/eta/eta.signer.ts` — CAdES-BES detached signature using cert + private key (USB token via `node-pkcs11` OR cloud HSM)
4. `apps/api/src/modules/eta/eta.submit.ts` — POST to ETA, parse response, update `invoices.eta_*` and write `eta_submissions` row
5. `apps/api/src/modules/eta/eta.qr.ts` — generate QR data per ETA spec after acceptance
6. `apps/api/src/jobs/eta-submission.job.ts` — BullMQ worker; exponential backoff (30s, 2min, 10min, 1h, 6h); after 5 retries → status=failed
7. After invoice transaction commits in Step 07, enqueue ETA job (don't block POS)
8. Refunds: generate ETA credit note linked to original `eta_long_id`
9. Receipt template: include QR code image (after acceptance)
10. Settings UI endpoint: encrypt `eta_client_secret` + `eta_client_id` with `APP_ENCRYPTION_KEY` before persisting
11. Admin endpoint: `POST /api/admin/eta/resubmit/:invoiceId` for manual retry

**Verify:**
- [ ] Submit 100 sample invoices to preprod — all `eta_status=accepted`
- [ ] Test with invalid taxpayer ID → ETA rejects → `eta_status=rejected` with `eta_error` populated
- [ ] Test signature with ETA's signature validator tool
- [ ] Test refund → credit note submitted and linked to original
- [ ] Verify QR code on printed receipt scans correctly with ETA's mobile app

**Done when:**
- [ ] All 100 preprod test invoices accepted
- [ ] Signature validates with ETA validator
- [ ] Failed submissions retry with backoff and ultimately surface for manual intervention
- [ ] Encryption working for `eta_client_secret` at rest
- [ ] QR code printed on receipts
- [ ] Credit note flow tested
- [ ] Switch to production environment only after preprod 100% green

**Commit:** `feat(step09a): eta e-invoicing integration with bullmq submission worker`

---

### Step 09b — Paymob SaaS Billing (~1 week)

**Goal:** Tenants can subscribe and pay via Paymob; dunning handles failures.

**Prerequisites:**
- [ ] Paymob merchant account (sandbox + production)
- [ ] API key, HMAC secret, integration IDs (card + wallet), iframe ID

**Read first:**
- COMPLETE_CONTEXT Section 4 (master.subscriptions Paymob fields, payment_attempts, dunning state machine)
- Paymob official API docs: https://accept.paymob.com/portal2/en/docs

**Tasks:**
1. `apps/api/src/modules/billing/paymob.client.ts` — auth token, order creation, payment key, recurring subscription via saved card token
2. `apps/api/src/modules/billing/paymob.webhook.ts` — HMAC SHA-512 verification (per snippet in COMPLETE_CONTEXT Section 4), update `payment_attempts` + `subscriptions`
3. `apps/api/src/modules/billing/billing.service.ts` — start trial, charge subscription, upgrade/downgrade/cancel, prorate
4. `apps/api/src/jobs/dunning.job.ts` — daily BullMQ cron:
   - Find subscriptions with `failed_attempts > 0` and last attempt > 3/7/14 days ago
   - Retry charge; on success reset counter
   - On failure: increment counter; transition statuses ACTIVE→PAST_DUE→SUSPENDED→CANCELLED per spec
   - Send appropriate email at each transition
5. Endpoints:
   - `POST /api/billing/checkout` — start payment session
   - `POST /api/billing/paymob/webhook` (no auth — verified via HMAC)
   - `GET /api/billing/portal` — current subscription + history
   - `POST /api/billing/cancel` — cancel at period end
6. Reconciliation cron: daily — fetch Paymob's transaction list and compare against `payment_attempts` to catch missed webhooks
7. Email templates (Resend): trial_ending, payment_succeeded, payment_failed, subscription_suspended, subscription_cancelled

**Verify:**
- [ ] Test with Paymob sandbox card (success)
- [ ] Test with Paymob sandbox card that always fails — full dunning cycle in test mode (with shortened intervals)
- [ ] Webhook idempotency: send same webhook twice, only one `payment_attempts` row written
- [ ] HMAC verification rejects tampered webhooks

**Done when:**
- [ ] Trial → paid conversion works
- [ ] Card update flow works
- [ ] Webhook HMAC verification working
- [ ] Webhooks idempotent on `provider_transaction_id`
- [ ] Dunning cycle tested with simulated failures
- [ ] Status transitions correct (TRIALING→ACTIVE→PAST_DUE→SUSPENDED→CANCELLED)
- [ ] Reconciliation cron catches missed webhooks
- [ ] All 5 email triggers fire correctly

**Commit:** `feat(step09b): paymob saas billing with hmac webhooks and dunning`

---

### Step 10 — Reports + Dashboard

**Goal:** All Phase 1 reports working with filters and export.

**Read first:**
- `documents/Markdown/Hesba_Logic_Flow_Document.md` Flow 11 (reports)
- `documents/Markdown/Hesba_Business_Document.md` Section 7 (KPIs)

**Tasks:**
1. Dashboard endpoint: `GET /api/reports/dashboard` returns today's sales, pending installments count, low-stock alerts, ETA submission failures, payment fee total
2. Sales report: `GET /api/reports/sales` with filters (date range, branch, cashier, payment method)
3. Stock report: current quantities + movements
4. Installments report: active, overdue, completed, total receivables
5. Fees report: by payment method + fee_bearer breakdown
6. Profit & loss: revenue − cost − expenses (including payment_fee_expenses)
7. Excel export via BullMQ (use `exceljs`); PDF export via Puppeteer
8. Redis cache for dashboard (2 min TTL)

**Done when:**
- [ ] All 6 reports return correct numbers (verify against raw SQL)
- [ ] Excel export works
- [ ] PDF export works (Arabic RTL)
- [ ] Dashboard cached in Redis
- [ ] `pnpm type-check` passes

**Commit:** `feat(step10): reports and dashboard with excel pdf export`

---

### Step 11 — Frontend Foundation (Design System FIRST)

> **⚠️ Per user directive: design system tokens come BEFORE any UI page.**

**Goal:** React + Vite + Tailwind set up with full design system tokens. No business pages yet — just shell + auth.

**Read first (in order):**
- `documents/Markdown/Hesba_Design_System.md` (entire doc — colors, typography, spacing, shadows, motion, RTL)
- `documents/Markdown/Hesba_Logic_Flow_Document.md` Flow 2 (login)
- `documents/Claude_Code/HESBA_COMPLETE_CONTEXT.md` Section 12 (design tokens)

**Step 11.0 — Design System Setup (do FIRST, no exceptions)**

1. `pnpm create vite apps/web --template react-ts`
2. Install deps: `react-router-dom @tanstack/react-query axios zustand react-hook-form zod tailwindcss postcss autoprefixer`
3. `apps/web/tailwind.config.ts` — port EVERY token from `Hesba_Design_System.md`:
   - Colors: brand (50–800), gray scale, semantic (success/warning/danger/info), accents (pink/cyan/violet/teal)
   - Fonts: `body: 'IBM Plex Sans Arabic'`, `display: 'Syne'`, `mono: 'JetBrains Mono'`
   - Spacing: sp-1 through sp-12 (4px base)
   - Border radius: r-sm/md/lg/xl/2xl/full
   - Shadows: sm/md/lg/xl/brand
   - Transitions: ease-fast/normal/slow/spring
   - Z-index scale
4. `apps/web/src/styles/globals.css` — `@tailwind` directives + CSS variables from Section 17 of design system + RTL base (`html { direction: rtl; }`)
5. `apps/web/src/styles/fonts.css` — `@import` IBM Plex Sans Arabic + Syne + JetBrains Mono from Google Fonts
6. `apps/web/index.html` — `<html lang="ar" dir="rtl">`
7. **Component library** in `apps/web/src/components/ui/` — implement BEFORE any page:
   - `Button` — 6 variants × 5 sizes per design system Section 6
   - `Input` — 6 states per Section 7
   - `Badge` — 6 variants, ALWAYS with dot or icon (color blindness rule)
   - `Card` — 4 variants per Section 10
   - `Table` — column color rules per Section 11
   - `Modal`, `Drawer`, `Toast`, `Alert`
   - `Skeleton` — shimmer per Section 5
   - `Money` — wraps numeric value with `dir="ltr"` + font-mono + brand-700 color (per Section 15 RTL rule)
8. Storybook OR a `/dev/components` route showing every variant — visual verification

**Step 11.1 — App Shell + Auth Pages**

9. `apps/web/src/api/client.ts` — axios with JWT refresh interceptor (per Tech Architecture doc)
10. `apps/web/src/stores/auth.store.ts` — Zustand: user, accessToken, permissions
11. Routing: `react-router-dom` with auth guard
12. Layout: AppShell (Sidebar 240px right + TopBar) — per page-design doc; tenant badge shows subdomain in TopBar
13. Pages: Login, Forgot Password, Reset Password, Register Tenant — using design-system components only

**Verify:**
```bash
pnpm dev:web
# Open browser, hard-refresh
# Visit /dev/components — every component renders correctly
# Visit /login — uses design system, RTL works, Arabic font loads
```

**Done when:**
- [ ] Tailwind config includes EVERY design system token
- [ ] All UI primitives in `components/ui/` exist with variants per design system
- [ ] `Money` component renders amounts as `1,250.00 ج` with `dir="ltr"` font-mono brand-700
- [ ] Badges always have dot OR icon (color-blindness rule enforced)
- [ ] RTL working: sidebar on right, content on left, active border-right
- [ ] IBM Plex Sans Arabic loaded; numbers render in JetBrains Mono
- [ ] axios interceptor auto-refreshes on 401
- [ ] Login → Dashboard works with seeded super_admin
- [ ] Forgot password / reset password flow works in UI
- [ ] `/dev/components` route shows every variant
- [ ] `pnpm type-check` passes

**Commit:** `feat(step11): frontend foundation with full design system and auth pages`

---

### Step 12 — Frontend POS

**Goal:** POS screen functional — search, scan, cart, checkout with fees, installment shortcut.

**Read first:**
- `documents/.trae/documents/phase1-mvp-page-design.md` (POS page design)
- `documents/Markdown/Hesba_Design_System.md` Sections 6 + 11 (buttons + tables)
- `documents/Markdown/Hesba_Payment_Fees_Update.md` (POS fee UI per Section 6)
- `documents/Markdown/Hesba_Logic_Flow_Document.md` Flow 13 (fee selection UI)

**Tasks:**
1. POS layout: 60% left (search + cart), 40% right (totals + payment)
2. Barcode scanner: USB HID auto-focus on input + camera fallback (`@zxing/browser`)
3. Cart with stock warnings, quantity steppers, line discounts
4. Customer attach (search/quick-create modal)
5. Totals panel — uses `Money` component throughout
6. Payment method selector — shows fee with each method per design system
7. Fee bearer toggle for `negotiable` methods (cashier role check)
8. "Complete Sale" → invoice details + Print button
9. Installment shortcut → contract creation form (national ID upload, digital signature canvas, schedule preview)

**Done when:**
- [ ] POS works on 1024×768+ desktop AND 10" tablet (touch-friendly)
- [ ] Barcode scanner adds variant to cart
- [ ] Stock warning shown when quantity exceeds available
- [ ] Fee correctly calculated and displayed per method
- [ ] Customer-bearing fee adds to total; merchant-bearing does not
- [ ] Sale completes; receipt prints (HTML page with print CSS)
- [ ] Installment flow creates pending_approval contract
- [ ] All amounts use `Money` component (font-mono, brand-700, RTL-safe)

**Commit:** `feat(step12): pos screen with barcode, fees, and installment flow`

---

### Step 13 — Remaining Frontend Pages

**Goal:** All remaining Phase 1 pages.

**Read first:**
- `documents/.trae/documents/phase1-mvp-page-design.md` (full page-by-page spec)
- `documents/.trae/documents/phase1-mvp-prd.md` (requirements per page)

**Pages:**
1. Products + Variants management (table + drawer; variant matrix UI)
2. Stock overview + adjustments + movements
3. Customers + details + documents upload
4. Invoices list + details + print
5. Installments work queue + approval UI for managers
6. Suppliers + Purchase Orders flow
7. Expenses + approval UI
8. Reports + Dashboard with charts (use Recharts or similar)
9. Settings:
   - Store profile
   - Payment methods CRUD with fee config
   - Users & Roles management
   - **ETA configuration** (Super Admin only) — taxpayer ID, activity code, branch code, certificate upload
   - Subscription / billing portal (current plan, payment history, update card)

**Done when (per page):**
- [ ] List view with pagination + search + filters
- [ ] Detail/form drawer or page
- [ ] All amounts use `Money` component
- [ ] Loading skeletons + empty states + error states
- [ ] Responsive (desktop primary, tablet works)
- [ ] Permissions enforced (UI hides actions user can't do)

**Commit per page:** `feat(step13/<page>): <page> screen`

---

### Step 14 — Phase 1 Polish + Deployment

**Goal:** Production-ready deployment.

**Tasks:**
1. CI/CD: GitHub Actions — lint + type-check + test on PR; deploy on main
2. Railway deployment for API + DB
3. Vercel deployment for frontend
4. Cloudflare DNS: `*.hesbaapp.com` wildcard
5. Wildcard SSL on Railway
6. Sentry integration for error tracking (both apps/api and apps/web)
7. Backup: PG daily snapshots configured on Railway
8. Run `migrateAllTenants()` against production after each deploy
9. Smoke test: register a new tenant in production, complete full POS flow with ETA submission
10. Performance: Lighthouse score > 85 for all key pages

**Done when:**
- [ ] CI green on main
- [ ] Production smoke test completed (real tenant, real sale, real ETA accept)
- [ ] Sentry receiving events
- [ ] PG backups verified (download + restore in staging)
- [ ] Lighthouse > 85
- [ ] Documentation updated with prod URLs

**Commit:** `chore(step14): phase 1 production deploy`

---

## 5. Cross-cutting rules (apply at every step)

These are non-negotiable. If a step's task description conflicts with these, the rule wins.

| Rule | Where it applies |
|---|---|
| All money is `DECIMAL(15,4)` in DB and `Decimal` in code (`decimal.js`) | Every monetary calculation |
| Every API request goes through tenant + auth middleware | Every protected route |
| Every multi-step DB op is a Prisma `$transaction` | Invoice, installment approve, PO receive, return, etc. |
| Every input is validated with Zod before use | Every route handler |
| Stock decrements use `updateMany` with `quantity: { gte: n }` (atomic) | POS, installment approve |
| Sensitive mutations write `audit_logs` row | Auth, invoice, installment, permission, price, stock adjustment |
| Bcrypt cost 12 for passwords; never SHA-256 | User auth |
| Tenant client cache is LRU (max 50, ttl 30min); never unbounded `Map` | `getTenantDb()` |
| RTL: `<html lang="ar" dir="rtl">`; numbers wrapped with `dir="ltr"` font-mono | All UI |
| Badges have dot OR icon, not color alone | All UI |
| Every commit message: `<type>(stepNN): <message>` | Every commit |
| `pnpm type-check` must pass before commit | Every commit |

---

## 6. Phase 1 completion criteria (what "done" means)

Phase 1 is complete when ALL of the following are true:

- [ ] All 14 steps' `Done when` checklists are 100% green
- [ ] A new user can: register tenant → log in → run POS sale → ETA-accepted invoice → print receipt with QR
- [ ] A new user can: subscribe via Paymob → receive Paymob receipt email
- [ ] A manager can: approve an installment contract → see schedule generated
- [ ] An accountant can: export sales + fees + P&L report
- [ ] All 6 reports return correct numbers vs raw SQL
- [ ] CI pipeline green; production deployed; backups working
- [ ] Sentry receiving events from prod
- [ ] At least one real (non-test) tenant has been onboarded successfully

---

## 7. Out of scope for Phase 1 (Phase 2+ backlog)

Documented here so they don't get accidentally added:
- Cashier shifts / cash drawer reconciliation
- Physical inventory count / wastage tracking
- Loyalty / gift cards / quotes / serial numbers
- 2FA for super admin
- Offline mode (PWA + sync)
- Multiple barcodes per variant
- Promotional pricing windows beyond basic `product_discounts`
- Bundles / combo products
- Custom domains for tenants
- Multi-language (only Arabic in Phase 1; English UI strings noted but not switchable)

---

*حِسبة Implementation Roadmap v1.2 — © 2026*
*Source of truth for execution order and acceptance criteria*
