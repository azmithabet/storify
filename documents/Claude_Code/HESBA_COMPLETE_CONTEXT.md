# حِسبة — Complete Project Context for Claude Code
> **هذا الملف يحتوي على كل شيء — لا تحتاج أي مصدر آخر**
> اقرأ هذا الملف كاملاً قبل كتابة أي سطر كود
> الإصدار: 1.2 | مايو 2026
>
> **⚠️ Read `Hesba_Patch_Notes_v1.2.md` first** — it documents what changed since v1.1 and why. Do not implement v1.1 code that conflicts with v1.2 patches.

---

# فهرس المحتويات

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Decisions](#2-tech-stack--decisions)
3. [Architecture Rules](#3-architecture-rules)
4. [Complete Database Schema](#4-complete-database-schema)
5. [Multi-tenant Architecture](#5-multi-tenant-architecture)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Payment Methods & Fees](#7-payment-methods--fees)
8. [Installment System](#8-installment-system)
9. [Roles & Permissions](#9-roles--permissions)
10. [Business Logic Rules](#10-business-logic-rules)
11. [API Design Standards](#11-api-design-standards)
12. [Design System Tokens](#12-design-system-tokens)
13. [Folder Structure](#13-folder-structure)
14. [Infrastructure & Deployment](#14-infrastructure--deployment)
15. [Default Seed Data](#15-default-seed-data)
16. [Implementation Steps](#16-implementation-steps)
17. [Current Status](#17-current-status)

---

# 📁 Companion Files Reference

> هذا الملف هو المرجع الرئيسي لـ Claude Code.
> الملفات التالية موجودة معه في نفس الـ ZIP — ارجع إليها للتفاصيل الكاملة.

## 📂 Claude_Code/ — ملفات التنفيذ
| الملف | المحتوى | متى تستخدمه؟ |
|---|---|---|
| `HESBA_COMPLETE_CONTEXT.md` | **هذا الملف** — كل التفاصيل التقنية | دائماً — المرجع الرئيسي |
| `STEP_01_PROJECT_SETUP.md` | تفاصيل Step 01 (مكتمل) | مراجعة ما تم إنجازه |
| `CLAUDE_CODE_STARTER_PROMPT.md` | Prompts جاهزة للـ Steps | نسخ prompt كل step |
| `HESBA_MASTER_DOCUMENT.md` | الـ Master document الكامل | مرجع شامل إضافي |

## 📂 Markdown/ — Documentation للقراءة والـ Context
| الملف | المحتوى | متى تستخدمه؟ |
|---|---|---|
| `Hesba_Business_Document.md` | وثيقة الأعمال — السوق، الباقات، الـ KPIs | فهم السياق التجاري |
| `Hesba_Logic_Flow_Document.md` | 13 flow كامل لكل العمليات | قبل تطوير أي module |
| `Hesba_ERD_Document.md` | ERD كامل بكل الجداول والعلاقات | مرجع DB إضافي |
| `Hesba_Technical_Architecture.md` | ADRs + Architecture decisions | فهم سبب كل قرار تقني |
| `Hesba_Design_System.md` | Design tokens + Components + RTL rules | تطوير الـ Frontend |
| `Hesba_Payment_Fees_Update.md` | تحديث نظام الـ Fees | تفاصيل إضافية عن الـ fees |

## 📂 Interactive/ — للمراجعة البشرية
| الملف | المحتوى |
|---|---|
| `Hesba_Wireframes.html` | **افتح في المتصفح** — 17 شاشة تفاعلية كاملة |
| `Hesba_Design_System.html` | **افتح في المتصفح** — Design System تفاعلي |

## 📂 PDFs/ — للطباعة والمشاركة
```
Hesba_Business_Document.pdf
Hesba_Logic_Flow_Document.pdf
Hesba_ERD_Document.pdf
Hesba_Technical_Architecture.pdf
Hesba_Design_System.pdf
Hesba_Payment_Fees_Update.pdf
```

---

## 🗺️ دليل الاستخدام لـ Claude Code

### عند تطوير أي Module — اتبع هذا الترتيب:
1. **Section 4** في هذا الملف → Database schema للـ module
2. `Hesba_Logic_Flow_Document.md` → الـ business flow الخاص بالـ module
3. **Section 10** في هذا الملف → Business logic rules
4. **Section 11** في هذا الملف → API design standards
5. `Hesba_Design_System.md` → عند تطوير الـ Frontend

### عند البدء في كل Step:
```
Step 02: هذا الملف Section 4 (Master DB) + Section 15 (Seed)
Step 03: هذا الملف Section 5 (Multi-tenant)
Step 04: هذا الملف Section 6 (Auth)
Step 05: هذا الملف Section 4 (Tenant Schema — كل الجداول)
Step 06: هذا الملف Section 4 + Hesba_Logic_Flow_Document.md (Flow 6)
Step 07: هذا الملف Section 7 (Fees) + Hesba_Logic_Flow_Document.md (Flow 3,4,5)
Step 08: هذا الملف Section 8 (Installments) + Hesba_Logic_Flow_Document.md (Flow 4)
Step 09: Hesba_Logic_Flow_Document.md (Flows 9,10)
Step 10: Hesba_Logic_Flow_Document.md (Flow 11)
Step 11+: Hesba_Design_System.md + Interactive/Hesba_Wireframes.html
```

---

---

# 1. Project Overview

## What is حِسبة?
حِسبة is a **B2B SaaS platform** for retail store and inventory management, built for the **Arabic market (Egypt)**. It is a multi-tenant system where each customer (store owner) gets a completely isolated environment.

## Target Users
- Retail stores (clothing, electronics, shoes, etc.)
- Supermarkets and grocery stores
- Store chains with multiple branches

## Business Model
- SaaS subscription: Monthly or Yearly
- 3 plans: Starter (199 EGP/mo), Professional (499 EGP/mo), Enterprise (999 EGP/mo)
- 14-day free trial, no credit card required

## Core Features (Phase 1 — Current)
1. Product management with barcode (Scanner + Camera)
2. POS — Sales with Cash, Card, Wallets, Installments
3. Payment Methods with configurable fees (auto-recorded as expenses)
4. Internal installments with manager approval + digital signature
5. External financing (Valu, Sympl)
6. Customer management + document upload (ID photos, signatures)
7. Inventory management with low-stock alerts
8. Stock transfers between branches
9. Returns (refund or credit balance)
10. Suppliers & Purchase Orders
11. Expenses with approval workflow
12. Reports & Dashboard
13. Multi-branch support
14. Multi-currency with exchange rate locking
15. User management with 5 roles

---

# 2. Tech Stack & Decisions

## Final Stack (DO NOT DEVIATE)

```
Monorepo:         pnpm workspaces
├── apps/api      Fastify 4.x + TypeScript (strict)
├── apps/web      React + Vite + TailwindCSS
├── packages/database  Prisma 5.x + PostgreSQL
└── packages/shared    Shared TypeScript types + utils

Backend:    Fastify + TypeScript
ORM:        Prisma 5.x (dynamic multi-schema)
Database:   PostgreSQL 16 (Schema-per-tenant isolation)
Cache:      Redis via ioredis (Upstash in production)
Queue:      BullMQ (PDF generation, SMS, Excel export)
Storage:    Cloudflare R2 (S3-compatible)
Validation: Zod — ALL inputs + env variables
Auth:       JWT Access (15min) + Refresh Token (7d, HttpOnly Cookie)
Frontend:   React + Vite + TailwindCSS + TanStack Query + Zustand
Hosting:    Railway (API + DB) + Vercel (Frontend) + Cloudflare (DNS + R2)
```

## ADR Summary (Why these choices)

| Decision | Choice | Reason |
|---|---|---|
| Backend Framework | Fastify | 2x faster than Express, WebSockets native, TypeScript first |
| Database | PostgreSQL | Schemas for tenant isolation — impossible with MySQL |
| ORM | Prisma | Type-safe queries, migrations, multi-schema support |
| Monorepo | pnpm workspaces | Share TypeScript types between Frontend and Backend |
| Auth | JWT + HttpOnly Cookie | HttpOnly prevents XSS token theft |
| Validation | Zod | Shared between FE and BE, parse don't validate |
| Queue | BullMQ | PDF/Excel generation without blocking API |
| Tenant Strategy | Schema-per-tenant | Complete data isolation, cheap vs separate DBs |

---

# 3. Architecture Rules

## CRITICAL — Never Break These Rules

### Rule 1: Financial Precision
```typescript
// ✅ CORRECT — Always use Prisma Decimal
const price = new Decimal("150.0000");
const fee = totalAmount.times(new Decimal("0.0175")); // 1.75%
const total = subtotal.plus(fee).toDecimalPlaces(4);

// ❌ WRONG — Never use JavaScript float for money
const price = 150.00;
const fee = total * 0.0175; // floating point error!
```
- ALL monetary DB fields: `DECIMAL(15,4)`
- ALL calculations: `decimal.js` library
- NEVER `parseFloat()` on monetary values

### Rule 2: Tenant Isolation
```typescript
// ✅ CORRECT — Always use tenant's db client
const products = await request.tenantDb.product.findMany();

// ❌ WRONG — Never use master db for tenant data
const products = await masterDb.product.findMany(); // WRONG!
```

### Rule 3: Transactions for Multi-step Operations
```typescript
// ✅ CORRECT — Invoice creation must be atomic
await db.$transaction(async (tx) => {
  const invoice = await tx.invoice.create({ data: invoiceData });
  for (const item of items) {
    await tx.stock.update({ /* decrement quantity */ });
    await tx.stockMovement.create({ /* log movement */ });
  }
  if (feeBearer === 'merchant' && feeAmount > 0) {
    await tx.paymentFeeExpense.create({ /* auto fee expense */ });
  }
});
```

### Rule 4: Zod for Everything
```typescript
// ✅ CORRECT — Validate before use
const body = CreateInvoiceSchema.parse(request.body);

// ❌ WRONG — Never trust raw input
const { items, customerId } = request.body; // WRONG!
```

### Rule 5: RTL Arabic UI
```html
<!-- ✅ CORRECT -->
<html lang="ar" dir="rtl">
  <span dir="ltr" class="font-mono">1,250.00 ج</span>

<!-- ❌ WRONG -->
<html lang="ar">  <!-- missing dir="rtl" -->
  <span>ج 1,250.00</span>  <!-- number direction wrong -->
```

### Rule 6: Installment Approval Gate
```typescript
// Installment status flow:
// pending_approval → (manager approves) → active → completed
// pending_approval → (manager rejects) → cancelled

// NEVER complete a sale with pending installment
if (contract.status === 'pending_approval') {
  return reply.status(400).send({ error: 'installment_approval_required' });
}
```

### Rule 7: Stock Updates in Transactions
- Stock ALWAYS decrements inside invoice creation transaction
- Stock ALWAYS increments inside purchase receipt transaction
- Returns: restock flag determines if stock increments

### Rule 8: Fee Auto-expense
- When `fee_bearer = 'merchant'`: auto-create `payment_fee_expenses` record
- This record appears in expense reports under "رسوم الدفع الإلكتروني"
- NO manual intervention needed

---

# 4. Complete Database Schema

## Master DB: `hesba_master`

### plans
```sql
id            CUID PRIMARY KEY
name          VARCHAR(100) UNIQUE NOT NULL  -- "Starter", "Professional", "Enterprise"
slug          VARCHAR(50) UNIQUE NOT NULL   -- "starter", "professional", "enterprise"
description   TEXT
max_products  INTEGER DEFAULT 100
max_orders    INTEGER DEFAULT 500
max_users     INTEGER DEFAULT 3
max_storage   INTEGER DEFAULT 1024         -- MB
price_monthly DECIMAL(10,2) NOT NULL
price_yearly  DECIMAL(10,2) NOT NULL
features      JSONB DEFAULT '[]'
is_active     BOOLEAN DEFAULT true
sort_order    INTEGER DEFAULT 0
created_at    TIMESTAMPTZ DEFAULT NOW()
updated_at    TIMESTAMPTZ AUTO UPDATE
```

**features JSONB example:**
```json
{
  "max_branches": 5,
  "max_users": 15,
  "installments": true,
  "multi_currency": true,
  "offline_mode": false,
  "suppliers": true,
  "expenses": true,
  "advanced_reports": true,
  "api_access": false
}
```

### tenants
```sql
id             CUID PRIMARY KEY
name           VARCHAR(200) NOT NULL
subdomain      VARCHAR(100) UNIQUE NOT NULL   -- "ahmed-store" — used for routing & provisioning
schema_name    VARCHAR(100) UNIQUE NOT NULL   -- "tenant_ahmed_store" — Postgres schema
schema_version INTEGER NOT NULL DEFAULT 0     -- last migration applied to this tenant's schema
email          VARCHAR(255) UNIQUE NOT NULL
phone          VARCHAR(50)
logo_url       TEXT
status         ENUM('ACTIVE','SUSPENDED','CANCELLED','PROVISIONING') DEFAULT 'PROVISIONING'
owner_name     VARCHAR(200) NOT NULL
owner_email    VARCHAR(255) NOT NULL
plan_id        CUID FK→plans
suspended_at   TIMESTAMPTZ                    -- when status was set to SUSPENDED
cancelled_at   TIMESTAMPTZ                    -- when status was set to CANCELLED (schema kept 30d for export)
created_at     TIMESTAMPTZ DEFAULT NOW()
updated_at     TIMESTAMPTZ AUTO UPDATE
```
> ⚠️ v1.2 — fields renamed: `slug` → `subdomain`, `db_name` → `schema_name`. `db_url` removed (derived from master URL + schema_name).

### subscriptions  ← v1.2: Paymob fields added
```sql
id                       CUID PRIMARY KEY
tenant_id                CUID FK→tenants CASCADE
plan_id                  CUID FK→plans
billing_cycle            ENUM('MONTHLY','YEARLY') NOT NULL
status                   ENUM('ACTIVE','PAST_DUE','CANCELLED','TRIALING','SUSPENDED') DEFAULT 'TRIALING'
current_period_start     TIMESTAMPTZ NOT NULL
current_period_end       TIMESTAMPTZ NOT NULL
cancelled_at             TIMESTAMPTZ
trial_ends_at            TIMESTAMPTZ
price_at_subscription    DECIMAL(10,2) NOT NULL

-- Paymob integration — v1.2
provider                 VARCHAR(50) DEFAULT 'paymob'        -- billing provider name
provider_subscription_id VARCHAR(200)                         -- Paymob subscription reference
provider_customer_id     VARCHAR(200)                         -- Paymob saved customer
provider_card_token      TEXT                                 -- Paymob tokenized card (for recurring)
last_payment_at          TIMESTAMPTZ
next_billing_at          TIMESTAMPTZ
failed_attempts          INTEGER DEFAULT 0                    -- dunning counter
last_failure_reason      TEXT                                 -- for support visibility

created_at               TIMESTAMPTZ DEFAULT NOW()
updated_at               TIMESTAMPTZ AUTO UPDATE
```
> Status `SUSPENDED` added — sits between PAST_DUE (still grace period, can self-recover by paying) and CANCELLED (admin must intervene).

### payment_attempts  ← NEW v1.2 (Master DB)
```sql
id                       CUID PRIMARY KEY
subscription_id          CUID NOT NULL FK→subscriptions
amount                   DECIMAL(10,2) NOT NULL
currency                 VARCHAR(10) DEFAULT 'EGP'
status                   ENUM('SUCCESS','FAILED','PENDING','REFUNDED') NOT NULL
provider                 VARCHAR(50) DEFAULT 'paymob'
provider_transaction_id  VARCHAR(200)
provider_response        JSONB                               -- full Paymob response for forensics
error_code               VARCHAR(100)
error_message            TEXT
attempt_type             VARCHAR(50) NOT NULL                -- initial | retry_3d | retry_7d | retry_14d | manual
attempted_at             TIMESTAMPTZ DEFAULT NOW()
INDEX idx_pay_subscription (subscription_id, attempted_at DESC)
INDEX idx_pay_status (status, attempted_at)
```
> Append-only — every Paymob charge attempt logged for support, refunds, and reconciliation.

### Paymob Webhook Verification (HMAC)
```typescript
// apps/api/src/modules/billing/paymob.webhook.ts
import { createHmac } from 'crypto';

export function verifyPaymobWebhook(payload: any, receivedHmac: string, secret: string): boolean {
  // Paymob sends specific fields in a specific concatenation order — must match docs exactly.
  // Common ordered fields: amount_cents, created_at, currency, error_occured, has_parent_transaction,
  // id, integration_id, is_3d_secure, is_auth, is_capture, is_refunded, is_standalone_payment,
  // is_voided, order.id, owner, pending, source_data.pan, source_data.sub_type, source_data.type, success.
  const concat = [
    payload.amount_cents, payload.created_at, payload.currency, payload.error_occured,
    payload.has_parent_transaction, payload.id, payload.integration_id, payload.is_3d_secure,
    payload.is_auth, payload.is_capture, payload.is_refunded, payload.is_standalone_payment,
    payload.is_voided, payload.order?.id, payload.owner, payload.pending,
    payload.source_data?.pan, payload.source_data?.sub_type, payload.source_data?.type,
    payload.success,
  ].join('');

  const computed = createHmac('sha512', secret).update(concat).digest('hex');
  return computed === receivedHmac;
}
```
> Webhook endpoint: `POST /api/billing/paymob/webhook` — verifies HMAC, updates `payment_attempts` + `subscriptions`, triggers dunning state machine.

### Dunning State Machine
```
Day 0:  charge fails           → failed_attempts = 1, status stays ACTIVE, email "payment failed, retrying"
Day 3:  retry → fail           → failed_attempts = 2, status stays ACTIVE, email
Day 7:  retry → fail           → failed_attempts = 3, status = PAST_DUE, login banner "update payment"
Day 14: retry → fail           → failed_attempts = 4, status = SUSPENDED, login blocked except billing page
Day 44: still no payment       → status = CANCELLED, schema kept 30 more days for export
Day 74: schema dropped, tenant data deleted
```

---

## Tenant Schema: `tenant_{subdomain}`
> All tables below exist in EACH tenant's isolated schema (36 tables as of v1.2)

### tenant_settings  ← v1.2: ETA fields added
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
currency_default    VARCHAR(10) DEFAULT 'EGP'
vat_enabled         BOOLEAN DEFAULT false
vat_rate            DECIMAL(5,2) DEFAULT 14.00
logo_url            TEXT
print_template      TEXT
language            VARCHAR(10) DEFAULT 'ar'
timezone            VARCHAR(50) DEFAULT 'Africa/Cairo'

-- ETA (Egyptian Tax Authority) configuration — v1.2
eta_enabled         BOOLEAN DEFAULT false
eta_environment     VARCHAR(20) DEFAULT 'preprod'   -- preprod | production
eta_taxpayer_id     VARCHAR(50)                      -- merchant's ETA registration ID (RIN)
eta_activity_code   VARCHAR(20)                      -- ETA activity classification (e.g., "4711")
eta_branch_code     VARCHAR(20) DEFAULT '0'          -- branch code as registered with ETA
eta_client_id       TEXT                             -- ETA portal client_id (encrypted at rest)
eta_client_secret   TEXT                             -- ETA portal client_secret (encrypted at rest)
eta_signing_cert    TEXT                             -- public cert PEM (private key in HSM/USB token)
eta_auto_submit     BOOLEAN DEFAULT true             -- if false, manual submit per invoice
eta_doc_type        VARCHAR(20) DEFAULT 'i'          -- 'i' = invoice (B2B), 'r' = receipt (B2C)

updated_at          TIMESTAMPTZ DEFAULT NOW()
```
> ETA secrets must be encrypted at rest (use `pgcrypto` or app-level AES). Private signing key is never stored in DB — it lives in a USB token or HSM that the ETA submission worker accesses at submission time.

### branches
```sql
id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
name       VARCHAR(200) NOT NULL
address    TEXT
phone      VARCHAR(50)
is_active  BOOLEAN DEFAULT true
created_at TIMESTAMPTZ DEFAULT NOW()
```

### roles
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        VARCHAR(100) NOT NULL
slug        VARCHAR(50) UNIQUE NOT NULL
permissions JSONB NOT NULL DEFAULT '{}'
is_system   BOOLEAN DEFAULT false    -- system roles cannot be deleted
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### users
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
branch_id     UUID FK→branches
role_id       UUID FK→roles
full_name     VARCHAR(200) NOT NULL
email         VARCHAR(255) UNIQUE NOT NULL
password_hash TEXT NOT NULL            -- SHA-256 + random salt: "salt:hash"
is_active     BOOLEAN DEFAULT true
last_login    TIMESTAMPTZ
created_at    TIMESTAMPTZ DEFAULT NOW()
updated_at    TIMESTAMPTZ AUTO UPDATE
```

### categories
```sql
id        UUID PRIMARY KEY DEFAULT gen_random_uuid()
name      VARCHAR(200) NOT NULL
parent_id UUID FK→categories          -- self-referential for subcategories
is_active BOOLEAN DEFAULT true
```

### tax_rates
```sql
id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
name       VARCHAR(100) NOT NULL       -- "بدون ضريبة", "VAT 14%"
rate       DECIMAL(5,2) NOT NULL       -- 0.00, 14.00
is_default BOOLEAN DEFAULT false
is_active  BOOLEAN DEFAULT true
```

### products
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
category_id UUID FK→categories
tax_rate_id UUID FK→tax_rates
name        VARCHAR(300) NOT NULL
description TEXT
unit        VARCHAR(50) DEFAULT 'piece'   -- piece, kg, liter, box
image_url   TEXT                          -- Cloudflare R2 URL (default image; per-variant image overrides)
has_variants BOOLEAN DEFAULT false        -- false = single auto-default variant; true = multi-variant
is_active   BOOLEAN DEFAULT true
created_at  TIMESTAMPTZ DEFAULT NOW()
updated_at  TIMESTAMPTZ AUTO UPDATE
```
> ⚠️ v1.2 — `barcode`, `cost_price`, `sell_price` moved to `product_variants`. Every product has at least one variant (auto-created when `has_variants = false`).

### product_variants  ← NEW v1.2 (CRITICAL for clothing/shoes/electronics market)
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
product_id  UUID NOT NULL FK→products ON DELETE CASCADE
sku         VARCHAR(100)
barcode     VARCHAR(100)
attributes  JSONB NOT NULL DEFAULT '{}'   -- {"size":"L","color":"red"} — empty for single-variant products
cost_price  DECIMAL(15,4) NOT NULL
sell_price  DECIMAL(15,4) NOT NULL
image_url   TEXT                          -- per-variant image; falls back to products.image_url
is_active   BOOLEAN DEFAULT true
created_at  TIMESTAMPTZ DEFAULT NOW()
UNIQUE(product_id, sku)
INDEX idx_variants_barcode (barcode) WHERE barcode IS NOT NULL
```

### stock
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
variant_id   UUID FK→product_variants     -- v1.2: was product_id
branch_id    UUID FK→branches
quantity     INTEGER NOT NULL DEFAULT 0
min_quantity INTEGER NOT NULL DEFAULT 0   -- low stock alert threshold
updated_at   TIMESTAMPTZ DEFAULT NOW()
UNIQUE(variant_id, branch_id)
```

### stock_movements
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
variant_id  UUID FK→product_variants     -- v1.2: was product_id
branch_id   UUID FK→branches
user_id     UUID FK→users
type        VARCHAR(50) NOT NULL    -- in, out, transfer, adjustment, return, damage
quantity    INTEGER NOT NULL        -- positive = in, negative = out
note        TEXT
reference   TEXT                   -- invoice_id or purchase_order_id
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### stock_transfers
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
from_branch_id UUID FK→branches
to_branch_id   UUID FK→branches
created_by     UUID FK→users
approved_by    UUID FK→users        -- NULL until approved
status         VARCHAR(50) DEFAULT 'pending'  -- pending, approved, rejected, completed
notes          TEXT
created_at     TIMESTAMPTZ DEFAULT NOW()
updated_at     TIMESTAMPTZ AUTO UPDATE
```

### stock_transfer_items
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
transfer_id UUID FK→stock_transfers
variant_id  UUID FK→product_variants    -- v1.2: was product_id
quantity    INTEGER NOT NULL
```

### currencies
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
code         VARCHAR(10) UNIQUE NOT NULL   -- EGP, USD, EUR
name         VARCHAR(100) NOT NULL
rate_to_base DECIMAL(15,6) NOT NULL        -- rate vs EGP
is_base      BOOLEAN DEFAULT false
updated_at   TIMESTAMPTZ DEFAULT NOW()
```

### customers
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
full_name      VARCHAR(200) NOT NULL
phone          VARCHAR(50)
national_id    VARCHAR(50)
address        TEXT
notes          TEXT
credit_balance DECIMAL(15,4) DEFAULT 0    -- from returns credited to account
created_at     TIMESTAMPTZ DEFAULT NOW()
updated_at     TIMESTAMPTZ AUTO UPDATE
```

### customer_documents
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id UUID FK→customers
doc_type    VARCHAR(100) NOT NULL   -- national_id_front, national_id_back, signature, receipt
file_url    TEXT NOT NULL           -- Cloudflare R2 URL
uploaded_by UUID FK→users
uploaded_at TIMESTAMPTZ DEFAULT NOW()
```

### payment_methods  ← NEW v1.1
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
name           VARCHAR(100) NOT NULL    -- "فيزا / ماستركارد", "فلوسة", "إنستاباي", "Valu"
type           VARCHAR(50) NOT NULL     -- card, wallet, bnpl, cash, bank_transfer
fee_type       VARCHAR(20) DEFAULT 'none'   -- none, percentage, fixed, both
fee_percentage DECIMAL(5,2) DEFAULT 0   -- e.g., 1.75 = 1.75%
fee_fixed      DECIMAL(10,2) DEFAULT 0  -- e.g., 2.00 EGP fixed
fee_bearer     VARCHAR(20) DEFAULT 'merchant'  -- customer, merchant, negotiable
is_active      BOOLEAN DEFAULT true
notes          TEXT
created_at     TIMESTAMPTZ DEFAULT NOW()
```

### coupons
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
code           VARCHAR(100) UNIQUE NOT NULL
discount_type  VARCHAR(20) NOT NULL   -- percentage, fixed
discount_value DECIMAL(10,2) NOT NULL
min_amount     DECIMAL(15,4)          -- minimum invoice amount to apply
max_uses       INTEGER                -- NULL = unlimited
used_count     INTEGER DEFAULT 0
expires_at     TIMESTAMPTZ
is_active      BOOLEAN DEFAULT true
created_at     TIMESTAMPTZ DEFAULT NOW()
```

### product_discounts
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
product_id     UUID FK→products
discount_type  VARCHAR(20) NOT NULL   -- percentage, fixed
discount_value DECIMAL(10,2) NOT NULL
start_date     DATE NOT NULL
end_date       DATE NOT NULL
is_active      BOOLEAN DEFAULT true
```

### invoices  ← v1.2: ETA fields added
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
branch_id         UUID FK→branches
customer_id       UUID FK→customers     -- NULL for anonymous cash sale
cashier_id        UUID FK→users
payment_method_id UUID FK→payment_methods   -- replaces payment_type string
currency_id       UUID FK→currencies
coupon_id         UUID FK→coupons
exchange_rate     DECIMAL(15,6) DEFAULT 1
subtotal          DECIMAL(15,4) NOT NULL
discount_amount   DECIMAL(15,4) DEFAULT 0
tax_total         DECIMAL(15,4) DEFAULT 0
fee_percentage    DECIMAL(5,2) DEFAULT 0     -- locked at sale time
fee_fixed         DECIMAL(10,2) DEFAULT 0    -- locked at sale time
fee_amount        DECIMAL(15,4) DEFAULT 0    -- calculated fee amount
fee_bearer        VARCHAR(20) DEFAULT 'merchant'
fee_added_to_total BOOLEAN DEFAULT false     -- true = customer pays fee
total_amount      DECIMAL(15,4) NOT NULL
paid_amount       DECIMAL(15,4) DEFAULT 0
status            VARCHAR(50) DEFAULT 'completed'   -- completed, refunded, partial_refund
notes             TEXT

-- ETA tracking — v1.2
eta_uuid          VARCHAR(100)                       -- assigned by ETA on accept (UUID)
eta_long_id       VARCHAR(200)                       -- ETA permanent reference (40-char alphanum)
eta_internal_id   VARCHAR(50) UNIQUE                 -- our internal submission ID (sent in payload.documentTypeVersion)
eta_status        VARCHAR(50) DEFAULT 'not_required' -- not_required | pending | submitted | accepted | rejected | failed
eta_submitted_at  TIMESTAMPTZ
eta_accepted_at   TIMESTAMPTZ
eta_qr_code       TEXT                               -- base64 QR code data, printed on receipt
eta_doc_type      VARCHAR(20)                        -- 'i' invoice | 'r' receipt — copied from tenant_settings at submit
eta_error         JSONB                              -- ETA validation errors when rejected

created_at        TIMESTAMPTZ DEFAULT NOW()
```
> **eta_status flow:** `not_required` (eta_enabled=false) → `pending` (queued for submission) → `submitted` (sent to ETA) → `accepted` (ETA approved) | `rejected` (ETA refused) | `failed` (network/auth error, retryable).
> **Refunds** require submitting a separate ETA credit note linked via `eta_long_id` of the original.

### invoice_items
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
invoice_id      UUID FK→invoices
variant_id      UUID FK→product_variants  -- v1.2: was product_id
quantity        INTEGER NOT NULL
unit_price      DECIMAL(15,4) NOT NULL    -- price at time of sale (historical)
discount_amount DECIMAL(15,4) DEFAULT 0
tax_rate_id     UUID FK→tax_rates
tax_amount      DECIMAL(15,4) DEFAULT 0
subtotal        DECIMAL(15,4) NOT NULL    -- (unit_price × qty) - discount + tax
```

### payment_fee_expenses  ← NEW v1.1
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
invoice_id        UUID FK→invoices
payment_method_id UUID FK→payment_methods
fee_amount        DECIMAL(15,4) NOT NULL
branch_id         UUID FK→branches
created_at        TIMESTAMPTZ DEFAULT NOW()
-- AUTO-CREATED when fee_bearer = 'merchant', never manual
```

### returns
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
invoice_id   UUID FK→invoices
processed_by UUID FK→users
return_type  VARCHAR(20) NOT NULL    -- refund, credit
amount       DECIMAL(15,4) NOT NULL
reason       TEXT
created_at   TIMESTAMPTZ DEFAULT NOW()
```

### return_items
```sql
id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
return_id  UUID FK→returns
variant_id UUID FK→product_variants    -- v1.2: was product_id
quantity   INTEGER NOT NULL
restock    BOOLEAN DEFAULT true    -- should this go back to stock?
```

### installment_contracts
```sql
id                        UUID PRIMARY KEY DEFAULT gen_random_uuid()
invoice_id                UUID FK→invoices
customer_id               UUID FK→customers
approved_by               UUID FK→users    -- NULL until manager approves
currency_id               UUID FK→currencies
exchange_rate_at_contract DECIMAL(15,6) DEFAULT 1   -- LOCKED at contract time
down_payment              DECIMAL(15,4) NOT NULL
installments_count        INTEGER NOT NULL
monthly_amount            DECIMAL(15,4) NOT NULL
interest_rate             DECIMAL(5,2) DEFAULT 0
total_amount              DECIMAL(15,4) NOT NULL
first_due_date            DATE NOT NULL
status                    VARCHAR(50) DEFAULT 'pending_approval'
-- pending_approval → active → completed | cancelled
guarantor_name            VARCHAR(200)
guarantor_phone           VARCHAR(50)
signature_url             TEXT              -- Cloudflare R2 URL
notes                     TEXT
created_at                TIMESTAMPTZ DEFAULT NOW()
updated_at                TIMESTAMPTZ AUTO UPDATE
```

### installment_payments
```sql
id                 UUID PRIMARY KEY DEFAULT gen_random_uuid()
contract_id        UUID FK→installment_contracts
received_by        UUID FK→users
installment_number INTEGER NOT NULL
amount_paid        DECIMAL(15,4) NOT NULL
due_date           DATE NOT NULL
paid_date          DATE
receipt_url        TEXT       -- Cloudflare R2 URL
status             VARCHAR(50) DEFAULT 'pending'   -- pending, paid, overdue
created_at         TIMESTAMPTZ DEFAULT NOW()
```

### external_financing
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
invoice_id     UUID FK→invoices
company_name   VARCHAR(200) NOT NULL   -- "Valu", "Sympl", bank name
reference_no   VARCHAR(200)
commission_pct DECIMAL(5,2) DEFAULT 0
created_at     TIMESTAMPTZ DEFAULT NOW()
```

### suppliers
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
name         VARCHAR(200) NOT NULL
phone        VARCHAR(50)
email        VARCHAR(255)
address      TEXT
tax_number   VARCHAR(100)
bank_account TEXT
balance      DECIMAL(15,4) DEFAULT 0   -- positive = supplier owes us, negative = we owe them
notes        TEXT
is_active    BOOLEAN DEFAULT true
created_at   TIMESTAMPTZ DEFAULT NOW()
```

### supplier_transactions
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
supplier_id UUID FK→suppliers
branch_id   UUID FK→branches
user_id     UUID FK→users
type        VARCHAR(50) NOT NULL   -- payment, purchase, return
amount      DECIMAL(15,4) NOT NULL
reference   TEXT
note        TEXT
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### purchase_orders
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
supplier_id   UUID FK→suppliers
branch_id     UUID FK→branches
created_by    UUID FK→users
approved_by   UUID FK→users
status        VARCHAR(50) DEFAULT 'draft'  -- draft, pending, approved, received, cancelled
total_amount  DECIMAL(15,4) NOT NULL
paid_amount   DECIMAL(15,4) DEFAULT 0
payment_type  VARCHAR(50)
expected_date DATE
created_at    TIMESTAMPTZ DEFAULT NOW()
updated_at    TIMESTAMPTZ AUTO UPDATE
```

### purchase_order_items
```sql
id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id   UUID FK→purchase_orders
variant_id UUID FK→product_variants    -- v1.2: was product_id
quantity   INTEGER NOT NULL
unit_cost  DECIMAL(15,4) NOT NULL
subtotal   DECIMAL(15,4) NOT NULL
```

### purchase_receipts
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id          UUID FK→purchase_orders
received_by       UUID FK→users
received_date     DATE NOT NULL
notes             TEXT
invoice_image_url TEXT    -- Cloudflare R2 URL
created_at        TIMESTAMPTZ DEFAULT NOW()
```

### purchase_payments
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id       UUID FK→purchase_orders
supplier_id    UUID FK→suppliers
paid_by        UUID FK→users
amount         DECIMAL(15,4) NOT NULL
payment_method VARCHAR(50)
receipt_url    TEXT
paid_at        TIMESTAMPTZ DEFAULT NOW()
```

### expense_categories
```sql
id        UUID PRIMARY KEY DEFAULT gen_random_uuid()
name      VARCHAR(200) NOT NULL   -- "إيجار", "كهرباء", "رواتب", "صيانة"
color     VARCHAR(20)
is_active BOOLEAN DEFAULT true
```

### expenses
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
branch_id      UUID FK→branches
category_id    UUID FK→expense_categories
created_by     UUID FK→users
approved_by    UUID FK→users
description    TEXT NOT NULL
amount         DECIMAL(15,4) NOT NULL
payment_method VARCHAR(50)
receipt_url    TEXT    -- Cloudflare R2 URL
expense_date   DATE NOT NULL
status         VARCHAR(50) DEFAULT 'pending'   -- pending, approved, rejected
created_at     TIMESTAMPTZ DEFAULT NOW()
```

### offline_queue
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
action_type   VARCHAR(100) NOT NULL   -- create_invoice, update_stock, etc.
payload       JSONB NOT NULL
created_at    TIMESTAMPTZ NOT NULL    -- offline creation time
synced_at     TIMESTAMPTZ
conflict      BOOLEAN DEFAULT false
conflict_data JSONB
```

### print_templates
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
type          VARCHAR(100) NOT NULL   -- invoice, contract, receipt, expense
name          VARCHAR(200) NOT NULL
html_template TEXT NOT NULL
is_default    BOOLEAN DEFAULT false
created_at    TIMESTAMPTZ DEFAULT NOW()
```

### audit_logs  ← NEW v1.2 (mandatory for financial compliance)
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
actor_id    UUID FK→users               -- NULL for system actions (cron, migrations)
entity      VARCHAR(100) NOT NULL       -- "invoice", "user", "permission", "installment"
entity_id   UUID                         -- the affected row's id
action      VARCHAR(50) NOT NULL         -- "create", "update", "delete", "approve", "reject", "login", "login_failed"
before      JSONB                        -- prior state (NULL on create / login)
after       JSONB                        -- new state (NULL on delete / login_failed)
ip          INET
user_agent  TEXT
created_at  TIMESTAMPTZ DEFAULT NOW()
INDEX idx_audit_entity (entity, entity_id)
INDEX idx_audit_actor  (actor_id, created_at DESC)
INDEX idx_audit_created (created_at DESC)
```
> **Mandatory audit events (Phase 1):** all login attempts, invoice create/refund, installment approve/reject, permission changes, user create/deactivate, price changes (variants), manual stock adjustments. Audit rows are immutable — no update or delete API.

### password_reset_tokens  ← NEW v1.2
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID NOT NULL FK→users ON DELETE CASCADE
token_hash  TEXT NOT NULL UNIQUE         -- SHA-256 of raw token (raw token only sent in email)
expires_at  TIMESTAMPTZ NOT NULL         -- 1 hour after creation
used_at     TIMESTAMPTZ                  -- NULL until consumed; one-time use
ip          INET                         -- requester IP for audit trail
created_at  TIMESTAMPTZ DEFAULT NOW()
INDEX idx_reset_user (user_id)
```
> **Flow:** `POST /auth/forgot-password { email }` → always 200 (no enumeration). If user exists, generate 32-byte random token, hash it, store hash, email raw token. `POST /auth/reset-password { token, newPassword }` → SHA-256 the input, lookup, verify `expires_at > now AND used_at IS NULL`, update password, set `used_at = now()`. Rate limit: 5 forgot-password requests per email per hour.

### eta_submissions  ← NEW v1.2 (Phase 1 ETA full integration audit trail)
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
invoice_id      UUID NOT NULL FK→invoices
attempt_number  INTEGER NOT NULL DEFAULT 1
direction       VARCHAR(20) NOT NULL          -- submit | cancel | credit_note
request_payload JSONB NOT NULL                -- full JSON sent to ETA (signed)
response_body   JSONB                         -- ETA response
http_status     INTEGER
eta_uuid        VARCHAR(100)                  -- assigned by ETA if submission accepted
status          VARCHAR(50) NOT NULL          -- pending | accepted | rejected | failed
error_code      VARCHAR(50)
error_message   TEXT
submitted_at    TIMESTAMPTZ DEFAULT NOW()
INDEX idx_eta_invoice (invoice_id, attempt_number)
INDEX idx_eta_status (status, submitted_at)
```
> Append-only audit log of every ETA interaction. Required for ETA dispute resolution and tax audits. Retry logic uses `attempt_number`; max 5 retries with exponential backoff before status → `failed` and manual intervention.

---

# 5. Multi-tenant Architecture

## How It Works
```
Request: GET https://ahmed-store.hesbaapp.com/api/products
         ↓
Tenant Middleware:
  1. Extract subdomain: "ahmed-store"
  2. Lookup in Master DB (Redis cache 5min)
  3. Check subscription status
  4. Get Prisma client for schema "tenant_ahmed_store" (LRU-cached)
  5. Attach to request: req.tenant, req.tenantDb
         ↓
Route Handler: uses req.tenantDb (ahmed-store's data only)
```

## Tenant Middleware Implementation
```typescript
// apps/api/src/shared/middleware/tenant.middleware.ts
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const subdomain = request.hostname.split('.')[0];

  // Skip for system routes
  if (['admin', 'www', 'api', 'localhost'].includes(subdomain)) return;

  // Check Redis cache first (5 min TTL)
  const cacheKey = `tenant:${subdomain}`;
  const cached = await redis.get(cacheKey);
  let tenant = cached ? JSON.parse(cached) : null;

  if (!tenant) {
    tenant = await masterDb.tenant.findUnique({
      where: { subdomain },                   // v1.2: was `slug`
      include: { plan: true },
    });
    if (tenant) {
      await redis.setex(cacheKey, 300, JSON.stringify(tenant));
    }
  }

  if (!tenant || tenant.status !== 'ACTIVE') {
    return reply.status(404).send({
      success: false,
      error: { code: 'tenant_not_found', message: 'المتجر غير موجود' }
    });
  }

  // Check subscription
  const now = new Date();
  if (tenant.trialEndsAt && new Date(tenant.trialEndsAt) < now) {
    const activeSub = await masterDb.subscription.findFirst({
      where: { tenantId: tenant.id, status: 'ACTIVE' }
    });
    if (!activeSub) {
      return reply.status(402).send({
        success: false,
        error: { code: 'subscription_expired', message: 'انتهى الاشتراك' }
      });
    }
  }

  request.tenant = tenant;
  request.tenantDb = getTenantDb(tenant.schemaName);   // v1.2: was tenant.dbName
}
```

## Dynamic Prisma Client (LRU + TTL eviction)  ← v1.2 fix
```typescript
// apps/api/src/config/database.ts
import { PrismaClient } from '@prisma/client';
import { LRUCache } from 'lru-cache';
import { config } from './env';

// Master DB — single instance
export const masterDb = new PrismaClient({
  datasources: { db: { url: config.DATABASE_MASTER_URL } },
  log: config.NODE_ENV === 'development' ? ['error'] : ['error'],
});

// Tenant clients — bounded LRU cache.
// Why: each PrismaClient holds a connection pool (~10 conns).
// Without bounds, 100 tenants = 1000 idle connections; PG default max = 100.
const tenantClients = new LRUCache<string, PrismaClient>({
  max: 50,                                  // most-recently-used 50 schemas in memory
  ttl: 1000 * 60 * 30,                      // 30 min idle TTL
  updateAgeOnGet: true,
  dispose: (client) => {                    // close pool on eviction
    client.$disconnect().catch(() => {});
  },
});

export function getTenantDb(schemaName: string): PrismaClient {
  const cached = tenantClients.get(schemaName);
  if (cached) return cached;

  const url = `${config.DATABASE_MASTER_URL}?schema=${schemaName}`;
  const client = new PrismaClient({
    datasources: { db: { url } },
  });
  tenantClients.set(schemaName, client);
  return client;
}
```

## Tenant Provisioning
```typescript
// apps/api/src/modules/tenants/tenant.service.ts
export async function provisionTenant(data: {
  name: string;
  subdomain: string;                          // v1.2: was `slug`
  planId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}) {
  const schemaName = `tenant_${data.subdomain.replace(/-/g, '_')}`;

  // 1. Create tenant in Master DB (status starts PROVISIONING)
  const tenant = await masterDb.tenant.create({
    data: {
      name: data.name,
      subdomain: data.subdomain,              // v1.2
      schemaName,                              // v1.2
      schemaVersion: 0,                        // v1.2 — bumped by migration runner
      email: data.ownerEmail,
      ownerName: data.ownerName,
      ownerEmail: data.ownerEmail,
      planId: data.planId,
      status: 'PROVISIONING',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  // 2. Create PostgreSQL Schema
  await masterDb.$executeRawUnsafe(
    `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`
  );

  // 3. Run tenant migrations (sets schemaVersion to current)
  await runTenantMigrations(schemaName, tenant.id);

  // 4. Seed defaults
  const db = getTenantDb(schemaName);
  await seedTenantDefaults(db, data.ownerName, data.ownerEmail, data.ownerPassword);

  // 5. Activate tenant
  await masterDb.tenant.update({
    where: { id: tenant.id },
    data: { status: 'ACTIVE' },
  });

  return tenant;
}
```

## Tenant Migration Runner  ← NEW v1.2
```typescript
// packages/database/src/migrate-tenants.ts
//
// Migration files live in:  packages/database/migrations/tenant/NNN_description.sql
// Numbered 001, 002, 003 … each is plain SQL, idempotent where possible.
// `tenants.schema_version` tracks the highest migration applied per tenant.

import fs from 'fs/promises';
import path from 'path';
import { masterDb, getTenantDb } from './prisma';

const MIGRATIONS_DIR = path.join(__dirname, '../migrations/tenant');

async function loadMigrations() {
  const files = (await fs.readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort();
  return Promise.all(files.map(async (f) => ({
    version: parseInt(f.split('_')[0], 10),
    name: f,
    sql: await fs.readFile(path.join(MIGRATIONS_DIR, f), 'utf8'),
  })));
}

export async function runTenantMigrations(schemaName: string, tenantId: string) {
  const tenant = await masterDb.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error(`tenant_not_found:${tenantId}`);

  const migrations = await loadMigrations();
  const pending = migrations.filter(m => m.version > tenant.schemaVersion);

  for (const m of pending) {
    const db = getTenantDb(schemaName);
    await db.$executeRawUnsafe(`SET search_path TO "${schemaName}"`);
    await db.$executeRawUnsafe(m.sql);
    await masterDb.tenant.update({
      where: { id: tenantId },
      data: { schemaVersion: m.version },
    });
    console.log(`✅ tenant=${schemaName} migration=${m.name} applied`);
  }
}

export async function migrateAllTenants() {
  // Used by deploy script — applies any new migrations to every tenant.
  const tenants = await masterDb.tenant.findMany({
    where: { status: { in: ['ACTIVE', 'SUSPENDED'] } },   // skip CANCELLED/PROVISIONING
  });

  const results = { ok: 0, failed: 0, errors: [] as Array<{ tenantId: string; err: string }> };
  for (const t of tenants) {
    try {
      await runTenantMigrations(t.schemaName, t.id);
      results.ok++;
    } catch (err) {
      results.failed++;
      results.errors.push({ tenantId: t.id, err: String(err) });
      console.error(`❌ tenant=${t.schemaName} migration failed:`, err);
      // Continue — don't abort the batch.
    }
  }
  return results;
}
```

## Feature Guard Middleware
```typescript
// apps/api/src/shared/middleware/feature.middleware.ts
export function requireFeature(feature: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const features = request.tenant.plan.features as Record<string, any>;
    if (!features[feature]) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'upgrade_required',
          message: 'هذه الميزة غير متاحة في باقتك الحالية',
          feature,
          upgradeUrl: `/billing/upgrade`,
        },
      });
    }
  };
}

// Usage in routes:
app.post('/installments',
  { preHandler: [authenticate, tenantMiddleware, requireFeature('installments')] },
  createInstallmentHandler
);
```

---

# 6. Authentication & Authorization

## JWT Strategy
```typescript
// Access Token payload
interface JWTPayload {
  userId: string;
  tenantId: string;
  schemaName: string;
  roleSlug: string;
  branchId: string;
  permissions: Record<string, string[]>; // { invoices: ['create', 'read'], ... }
  iat: number;
  exp: number;
}

// Access Token: 15 minutes → sent in Authorization: Bearer header
// Refresh Token: 7 days → stored in HttpOnly Cookie only
```

## Password Hashing  ← v1.2 fix (bcrypt, not SHA-256)
```typescript
// apps/api/src/shared/utils/password.ts
//
// Why bcrypt: SHA-256 is a fast hash unsuitable for passwords (a GPU computes
// billions of SHA-256 hashes per second). bcrypt is slow by design and
// includes a per-hash salt automatically. Cost factor 12 ≈ 250ms on a
// modern CPU — slow enough to defeat brute force, fast enough for login UX.
import bcrypt from 'bcryptjs';

const COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  return bcrypt.compare(password, stored);
}
```

## Password Reset Flow  ← NEW v1.2
```typescript
// apps/api/src/modules/auth/auth.service.ts
import { createHash, randomBytes } from 'crypto';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function requestPasswordReset(
  db: PrismaClient,
  email: string,
  ip: string
) {
  const user = await db.user.findUnique({ where: { email } });
  // Always return 200 — never reveal whether an email exists (prevents enumeration).
  if (!user || !user.isActive) return;

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      ip,
    },
  });

  // Send `rawToken` via email — never persist it. The DB only stores the hash.
  await sendPasswordResetEmail(user.email, rawToken);
}

export async function resetPassword(
  db: PrismaClient,
  rawToken: string,
  newPassword: string
) {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new Error('invalid_or_expired_token');
  }

  const passwordHash = await hashPassword(newPassword);

  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);
}
```
> **Rate limit:** 5 forgot-password requests per email per hour (Redis-backed).
> **Email content:** raw token in URL — `https://{subdomain}.hesbaapp.com/reset?token={rawToken}`. Token TTL 1 hour, single-use.

## Auth Middleware
```typescript
// apps/api/src/shared/middleware/auth.middleware.ts
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: 'unauthorized', message: 'يجب تسجيل الدخول أولاً' }
    });
  }
}

export function requirePermission(resource: string, action: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JWTPayload;
    
    // Super admin bypasses all checks
    if (user.roleSlug === 'super_admin') return;

    const permissions = user.permissions;
    if (!permissions[resource]?.includes(action)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'forbidden',
          message: 'ليس لديك صلاحية للقيام بهذا الإجراء',
          required: `${resource}:${action}`,
        },
      });
    }
  };
}
```

---

# 7. Payment Methods & Fees

## Fee Calculation Logic
```typescript
// apps/api/src/shared/utils/fee.ts
import Decimal from 'decimal.js';

export interface FeeResult {
  feeAmount: Decimal;
  feeAddedToTotal: boolean;
  finalTotal: Decimal;
}

export function calculateFee(
  totalAmount: Decimal,
  paymentMethod: {
    feeType: string;
    feePercentage: Decimal;
    feeFixed: Decimal;
    feeBearer: string;
  }
): FeeResult {
  let feeAmount = new Decimal(0);

  switch (paymentMethod.feeType) {
    case 'percentage':
      feeAmount = totalAmount
        .times(paymentMethod.feePercentage)
        .dividedBy(100)
        .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      break;
    case 'fixed':
      feeAmount = paymentMethod.feeFixed;
      break;
    case 'both':
      feeAmount = totalAmount
        .times(paymentMethod.feePercentage)
        .dividedBy(100)
        .plus(paymentMethod.feeFixed)
        .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      break;
    case 'none':
    default:
      feeAmount = new Decimal(0);
  }

  const feeAddedToTotal = paymentMethod.feeBearer === 'customer';
  const finalTotal = feeAddedToTotal
    ? totalAmount.plus(feeAmount)
    : totalAmount;

  return { feeAmount, feeAddedToTotal, finalTotal };
}
```

## Fee in Invoice Creation
```typescript
// When creating invoice:
const { feeAmount, feeAddedToTotal, finalTotal } = calculateFee(subtotal, paymentMethod);

await db.$transaction(async (tx) => {
  const invoice = await tx.invoice.create({
    data: {
      ...invoiceData,
      feePercentage: paymentMethod.feePercentage,
      feeFixed: paymentMethod.feeFixed,
      feeAmount,
      feeBearer: paymentMethod.feeBearer,
      feeAddedToTotal,
      totalAmount: finalTotal,
    }
  });

  // Auto-create expense when merchant bears the fee
  if (paymentMethod.feeBearer === 'merchant' && feeAmount.greaterThan(0)) {
    await tx.paymentFeeExpense.create({
      data: {
        invoiceId: invoice.id,
        paymentMethodId: paymentMethod.id,
        feeAmount,
        branchId: invoice.branchId,
      }
    });
  }
  
  // ... rest of transaction (stock updates, etc.)
});
```

## Default Payment Methods (seeded per tenant)
```typescript
const DEFAULT_PAYMENT_METHODS = [
  { name: 'كاش',               type: 'cash',          feeType: 'none',       feePercentage: 0,    feeFixed: 0,  feeBearer: 'merchant' },
  { name: 'فيزا / ماستركارد', type: 'card',          feeType: 'percentage', feePercentage: 1.75, feeFixed: 0,  feeBearer: 'merchant' },
  { name: 'فلوسة',             type: 'wallet',        feeType: 'fixed',      feePercentage: 0,    feeFixed: 2,  feeBearer: 'merchant' },
  { name: 'إنستاباي',         type: 'wallet',        feeType: 'none',       feePercentage: 0,    feeFixed: 0,  feeBearer: 'merchant' },
  { name: 'Valu',              type: 'bnpl',          feeType: 'percentage', feePercentage: 3,    feeFixed: 0,  feeBearer: 'merchant' },
  { name: 'تحويل بنكي',       type: 'bank_transfer', feeType: 'fixed',      feePercentage: 0,    feeFixed: 5,  feeBearer: 'negotiable' },
];
```

---

# 8. Installment System

## Status Flow
```
pending_approval → active → completed
pending_approval → cancelled (manager rejects)
```

## Monthly Amount Formula
```typescript
// monthly = (total - downPayment + interest) / installmentsCount
// interest = (total - downPayment) * (interestRate / 100) * (installmentsCount / 12)

function calculateMonthlyAmount(
  total: Decimal,
  downPayment: Decimal,
  installmentsCount: number,
  interestRate: Decimal
): Decimal {
  const principal = total.minus(downPayment);
  const interest = principal
    .times(interestRate.dividedBy(100))
    .times(new Decimal(installmentsCount).dividedBy(12));
  return principal.plus(interest)
    .dividedBy(installmentsCount)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}
```

## Installment Creation Flow
```typescript
// 1. Cashier creates installment contract
// 2. Contract saved with status = 'pending_approval'
// 3. Invoice created with status = 'pending'
// 4. Stock NOT updated yet
// 5. Notification sent to manager

// Manager approval endpoint:
app.patch('/installments/:contractId/approve',
  { preHandler: [authenticate, tenantMiddleware, requirePermission('installments', 'approve')] },
  async (request, reply) => {
    const db = request.tenantDb;
    
    await db.$transaction(async (tx) => {
      // Update contract
      await tx.installmentContract.update({
        where: { id: contractId },
        data: { status: 'active', approvedBy: request.user.userId }
      });
      
      // Complete invoice
      await tx.invoice.update({
        where: { id: contract.invoiceId },
        data: { status: 'completed', paidAmount: contract.downPayment }
      });
      
      // NOW update stock
      for (const item of invoiceItems) {
        await tx.stock.update({ /* decrement */ });
        await tx.stockMovement.create({ /* log */ });
      }
      
      // Generate installment schedule
      for (let i = 1; i <= contract.installmentsCount; i++) {
        await tx.installmentPayment.create({
          data: {
            contractId,
            installmentNumber: i,
            amountPaid: contract.monthlyAmount,
            dueDate: addMonths(contract.firstDueDate, i - 1),
            status: 'pending',
          }
        });
      }
    });
  }
);
```

---

# 9. Roles & Permissions

## 5 System Roles

```typescript
const DEFAULT_ROLES = [
  {
    name: 'Super Admin',
    slug: 'super_admin',
    isSystem: true,
    permissions: {
      branches: ['create', 'read', 'update', 'delete'],
      users: ['create', 'read', 'update', 'delete'],
      products: ['create', 'read', 'update', 'delete'],
      stock: ['read', 'update', 'transfer'],
      invoices: ['create', 'read', 'update', 'delete'],
      installments: ['create', 'read', 'approve', 'update'],
      suppliers: ['create', 'read', 'update', 'delete'],
      purchases: ['create', 'read', 'approve'],
      expenses: ['create', 'read', 'approve'],
      customers: ['create', 'read', 'update', 'delete'],
      reports: ['read', 'export'],
      settings: ['read', 'update'],
      payment_methods: ['create', 'read', 'update', 'delete'],
    },
  },
  {
    name: 'Branch Manager',
    slug: 'branch_manager',
    isSystem: true,
    permissions: {
      branches: ['read'],
      users: ['create', 'read', 'update'],
      products: ['create', 'read', 'update'],
      stock: ['read', 'update', 'transfer'],
      invoices: ['create', 'read', 'update'],
      installments: ['create', 'read', 'approve'],
      suppliers: ['read'],
      purchases: ['create', 'read'],
      expenses: ['create', 'read', 'approve'],
      customers: ['create', 'read', 'update'],
      reports: ['read', 'export'],
      settings: ['read'],
      payment_methods: ['read'],
    },
  },
  {
    name: 'Cashier',
    slug: 'cashier',
    isSystem: true,
    permissions: {
      products: ['read'],
      stock: ['read'],
      invoices: ['create', 'read'],
      installments: ['create'],
      customers: ['create', 'read', 'update'],
      payment_methods: ['read'],
    },
  },
  {
    name: 'Inventory Keeper',
    slug: 'inventory_keeper',
    isSystem: true,
    permissions: {
      products: ['create', 'read', 'update'],
      stock: ['read', 'update', 'transfer'],
      purchases: ['create', 'read'],
      suppliers: ['read'],
      reports: ['read'],
    },
  },
  {
    name: 'Accountant',
    slug: 'accountant',
    isSystem: true,
    permissions: {
      invoices: ['read'],
      installments: ['read', 'update'],
      expenses: ['read'],
      suppliers: ['read'],
      purchases: ['read'],
      reports: ['read', 'export'],
      payment_methods: ['read'],
    },
  },
];
```

---

# 10. Business Logic Rules

## Invoice Creation (Complete Flow)  ← v1.2: stock check INSIDE transaction
```typescript
// CRITICAL change from v1.1: do NOT pre-validate stock before the transaction.
// Two cashiers selling the last unit simultaneously would both pass a pre-check,
// and both transactions would commit, sending stock negative.
//
// Instead: use a conditional updateMany that only succeeds when stock is sufficient.
// This is atomic at the DB level — Postgres acquires a row lock during UPDATE.

async function createInvoice(db: PrismaClient, data: CreateInvoiceDTO) {
  // 1. Calculate totals (no stock query needed yet)
  const paymentMethod = await db.paymentMethod.findUnique({
    where: { id: data.paymentMethodId },
  });
  if (!paymentMethod) throw new Error('payment_method_not_found');
  // ... calculate subtotal, tax, discount, fee using Decimal

  // 2. Atomic transaction — stock decrement is the gate
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({ data: { ...invoiceData } });

    for (const item of data.items) {
      // Atomic stock decrement: only succeeds if quantity >= item.quantity.
      // Returns count = 0 when condition fails (insufficient stock or row missing).
      const result = await tx.stock.updateMany({
        where: {
          variantId: item.variantId,
          branchId: data.branchId,
          quantity: { gte: item.quantity },     // ← race-safe gate
        },
        data: { quantity: { decrement: item.quantity } },
      });
      if (result.count === 0) {
        // Aborts the whole transaction — invoice rolls back.
        throw new Error(`insufficient_stock:${item.variantId}`);
      }

      await tx.invoiceItem.create({
        data: { invoiceId: invoice.id, variantId: item.variantId, ...itemData },
      });

      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          branchId: data.branchId,
          userId: data.cashierId,
          type: 'out',
          quantity: -item.quantity,
          reference: invoice.id,
        },
      });
    }

    if (data.couponId) {
      await tx.coupon.update({
        where: { id: data.couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    // Auto fee expense if merchant bears it
    if (paymentMethod.feeBearer === 'merchant' && feeAmount.greaterThan(0)) {
      await tx.paymentFeeExpense.create({
        data: {
          invoiceId: invoice.id,
          paymentMethodId: paymentMethod.id,
          feeAmount,
          branchId: data.branchId,
        },
      });
    }

    // Audit log (mandatory per v1.2)
    await tx.auditLog.create({
      data: {
        actorId: data.cashierId,
        entity: 'invoice',
        entityId: invoice.id,
        action: 'create',
        after: { totalAmount: invoice.totalAmount, items: data.items.length },
      },
    });

    return invoice;
  });
}
```

## Stock Alert Check (after every stock change)
```typescript
async function checkLowStockAlert(db: PrismaClient, productId: string, branchId: string) {
  const stock = await db.stock.findUnique({
    where: { productId_branchId: { productId, branchId } },
    include: { product: true }
  });
  if (stock && stock.quantity <= stock.minQuantity) {
    // Create notification (or use BullMQ for SMS)
    // In Phase 1: just flag it, dashboard picks it up
  }
}
```

## Discount Priority Order
```
1. Product-level discount (product_discounts table, by date range)
2. Coupon discount (applied after product discounts)
3. Invoice-level discount (cashier applies manually)
4. Payment fee (applied last, after all discounts)
```

---

# 11. API Design Standards

## URL Pattern
```
/api/auth/login          POST
/api/auth/refresh        POST
/api/auth/logout         POST
/api/tenants/register    POST

/api/products            GET, POST
/api/products/:id        GET, PATCH, DELETE
/api/products/barcode/:code  GET

/api/stock               GET
/api/stock/:productId    PATCH
/api/stock/movements     GET
/api/stock/transfers     GET, POST
/api/stock/transfers/:id/approve  PATCH

/api/invoices            GET, POST
/api/invoices/:id        GET, PATCH

/api/installments        GET
/api/installments/:id    GET
/api/installments/:id/approve    PATCH
/api/installments/:id/reject     PATCH
/api/installments/:id/payment    POST

/api/customers           GET, POST
/api/customers/:id       GET, PATCH
/api/customers/:id/documents  POST

/api/payment-methods     GET, POST
/api/payment-methods/:id PATCH, DELETE

/api/suppliers           GET, POST
/api/suppliers/:id       GET, PATCH
/api/suppliers/:id/transaction  POST

/api/purchase-orders     GET, POST
/api/purchase-orders/:id GET, PATCH
/api/purchase-orders/:id/receive  POST

/api/expenses            GET, POST
/api/expenses/:id        PATCH

/api/reports/dashboard   GET
/api/reports/sales       GET
/api/reports/stock       GET
/api/reports/installments GET
/api/reports/fees        GET
/api/reports/profit-loss GET

/api/settings            GET, PATCH
/api/settings/payment-methods  GET, POST, PATCH
```

## Response Format
```typescript
// Success (single item)
{ success: true, data: { id: "...", ... } }

// Success (list)
{ success: true, data: [...], meta: { total: 234, page: 1, limit: 20, pages: 12 } }

// Error
{
  success: false,
  error: {
    code: 'validation_error' | 'not_found' | 'forbidden' | 'unauthorized' |
          'subscription_expired' | 'upgrade_required' | 'insufficient_stock' |
          'installment_approval_required' | 'duplicate_entry' | 'internal_error',
    message: 'Human readable Arabic message',
    details?: [{ field: 'email', message: 'غير صحيح' }]  // for validation errors
  }
}

// HTTP Status codes:
// 200 OK, 201 Created, 400 Validation Error, 401 Unauthorized,
// 402 Subscription Required, 403 Forbidden/Upgrade Required,
// 404 Not Found, 409 Conflict, 500 Internal Error
```

## Pagination Standard
```typescript
// Query params: ?page=1&limit=20&search=...&sortBy=createdAt&sortOrder=desc
// Default: page=1, limit=20, sortOrder=desc

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}
```

---

# 12. Design System Tokens

## Colors
```css
/* Brand */
--brand-500: #6366F1;  /* Primary */
--brand-600: #4F46E5;  /* Button background */
--brand-700: #4338CA;  /* Hover */

/* Semantic */
--success-500: #10B981;
--warning-500: #F59E0B;
--danger-500:  #EF4444;
--info-500:    #3B82F6;

/* Neutral */
--gray-50:  #F8FAFC;  /* Page background */
--gray-100: #F1F5F9;  /* Section background */
--gray-200: #E2E8F0;  /* Borders */
--gray-400: #94A3B8;  /* Placeholder, icons */
--gray-500: #64748B;  /* Muted text */
--gray-700: #334155;  /* Secondary text */
--gray-800: #1E293B;  /* Primary text */
--gray-900: #0F172A;  /* Headings */

/* Accent */
--accent-violet: #8B5CF6;  /* Installments */
--accent-teal:   #14B8A6;  /* Stock transfers */
--accent-pink:   #EC4899;  /* Highlights */
```

## Typography
```css
--font-body:    'IBM Plex Sans Arabic', sans-serif;  /* All UI text */
--font-mono:    'JetBrains Mono', monospace;          /* Numbers, codes, amounts */
--font-display: 'Syne', sans-serif;                   /* Page titles only */
```

## Spacing (4px base)
```css
--sp-1: 4px;   --sp-2: 8px;   --sp-3: 12px;  --sp-4: 16px;
--sp-5: 20px;  --sp-6: 24px;  --sp-8: 32px;  --sp-12: 48px;
```

## Border Radius
```css
--r-sm: 4px;    /* badges */
--r-md: 8px;    /* buttons, inputs */
--r-lg: 12px;   /* small cards */
--r-xl: 16px;   /* cards, modals */
--r-full: 9999px; /* pills, toggles */
```

## Key UI Rules
1. ALL monetary values: `font-mono` + `color: brand-700`
2. Badges ALWAYS have dot OR icon (not color alone — color blindness)
3. Numbers in RTL context: `dir="ltr"` + `display: inline-block`
4. Amounts format: `1,250.00 ج` (number before currency symbol in RTL)
5. Dark sidebar: `background: #0F172A` with `color: rgba(255,255,255,.4)`
6. Active sidebar item: `border-right: 2px solid brand-500` (RTL = right)
7. Error states: icon + text + color (never just color)

---

# 13. Folder Structure

## Complete Structure
```
hesba/
├── .env                          ← Root env file
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json                  ← Root scripts
├── pnpm-workspace.yaml
│
├── apps/
│   ├── api/
│   │   ├── package.json          ← @hesba/api
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts          ← App entry point
│   │       ├── config/
│   │       │   ├── env.ts        ← Zod env validation
│   │       │   ├── database.ts   ← masterDb + getTenantDb()
│   │       │   └── redis.ts      ← ioredis client
│   │       ├── modules/
│   │       │   ├── auth/
│   │       │   │   ├── auth.routes.ts
│   │       │   │   ├── auth.service.ts
│   │       │   │   └── auth.schema.ts    ← Zod schemas
│   │       │   ├── tenants/
│   │       │   │   ├── tenant.routes.ts
│   │       │   │   ├── tenant.service.ts ← provisionTenant()
│   │       │   │   └── tenant.schema.ts
│   │       │   ├── products/
│   │       │   ├── stock/
│   │       │   ├── invoices/
│   │       │   ├── installments/
│   │       │   ├── customers/
│   │       │   ├── payment-methods/
│   │       │   ├── suppliers/
│   │       │   ├── purchase-orders/
│   │       │   ├── expenses/
│   │       │   └── reports/
│   │       ├── shared/
│   │       │   ├── middleware/
│   │       │   │   ├── tenant.middleware.ts
│   │       │   │   ├── auth.middleware.ts
│   │       │   │   └── feature.middleware.ts
│   │       │   ├── plugins/
│   │       │   │   ├── jwt.plugin.ts
│   │       │   │   ├── cors.plugin.ts
│   │       │   │   ├── helmet.plugin.ts
│   │       │   │   └── rate-limit.plugin.ts
│   │       │   └── utils/
│   │       │       ├── password.ts      ← hash + verify
│   │       │       ├── fee.ts           ← calculateFee()
│   │       │       ├── decimal.ts       ← financial helpers
│   │       │       └── pagination.ts    ← cursor pagination
│   │       ├── jobs/
│   │       │   ├── pdf.job.ts
│   │       │   ├── excel.job.ts
│   │       │   └── sms.job.ts
│   │       └── types/
│   │           └── fastify.d.ts  ← augment Request with tenant, tenantDb
│   │
│   └── web/
│       ├── package.json          ← @hesba/web
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── api/
│           │   ├── client.ts     ← axios with JWT refresh interceptor
│           │   ├── auth.api.ts
│           │   ├── products.api.ts
│           │   └── ...
│           ├── components/
│           │   ├── ui/           ← Button, Input, Modal, Table, Badge...
│           │   ├── layout/       ← Sidebar, Topbar, PageWrapper
│           │   └── features/     ← InvoiceCard, CartItem, ProductCard...
│           ├── pages/
│           │   ├── auth/
│           │   ├── dashboard/
│           │   ├── pos/          ← POS screen
│           │   ├── invoices/
│           │   ├── installments/
│           │   ├── products/
│           │   ├── stock/
│           │   ├── customers/
│           │   ├── suppliers/
│           │   ├── expenses/
│           │   ├── reports/
│           │   └── settings/
│           ├── stores/
│           │   ├── auth.store.ts  ← Zustand: user, tenant, permissions
│           │   ├── cart.store.ts  ← Zustand: POS cart
│           │   └── ui.store.ts
│           ├── hooks/
│           │   ├── usePermission.ts
│           │   ├── useTenant.ts
│           │   └── useBarcode.ts
│           └── types/
│
├── packages/
│   ├── database/
│   │   ├── package.json          ← @hesba/database
│   │   ├── prisma/
│   │   │   ├── schema.prisma     ← Master DB schema
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── index.ts          ← exports
│   │       ├── prisma.ts         ← singleton client
│   │       └── seeds/
│   │           ├── master.seed.ts ← plans seed
│   │           └── tenant.seed.ts ← tenant defaults seed
│   │
│   └── shared/
│       ├── package.json          ← @hesba/shared
│       └── src/
│           ├── types/            ← shared DTOs and response types
│           ├── constants/        ← roles, status values, etc.
│           └── utils/            ← shared pure functions
│
└── infrastructure/
    └── docker/
```

## Package.json Scripts (Root)
```json
{
  "scripts": {
    "dev:api": "pnpm --filter @hesba/api dev",
    "dev:web": "pnpm --filter @hesba/web dev",
    "build": "pnpm -r build",
    "type-check": "pnpm -r type-check",
    "lint": "pnpm -r lint",
    "db:generate": "pnpm --filter @hesba/database db:generate",
    "db:migrate": "pnpm --filter @hesba/database db:migrate",
    "db:seed": "pnpm --filter @hesba/database db:seed",
    "db:studio": "pnpm --filter @hesba/database db:studio",
    "db:reset": "pnpm --filter @hesba/database db:reset",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down"
  }
}
```

---

# 14. Infrastructure & Deployment

## Environment Variables (.env)
```env
# Database
DATABASE_MASTER_URL="postgresql://postgres:password@localhost:5432/hesba_master"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT (minimum 32 chars each)
JWT_ACCESS_SECRET="hesba-access-secret-change-this-in-prod-32+"
JWT_REFRESH_SECRET="hesba-refresh-secret-change-this-in-prod-32+"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# App
NODE_ENV="development"
API_PORT=3000
API_HOST="0.0.0.0"
FRONTEND_URL="http://localhost:5173"

# Cloudflare R2 (optional for dev)
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="hesba-uploads"
R2_PUBLIC_URL=""

# Paymob (SaaS billing) — v1.2
PAYMOB_API_KEY=""
PAYMOB_HMAC_SECRET=""
PAYMOB_INTEGRATION_ID_CARD=""        # for card payments
PAYMOB_INTEGRATION_ID_WALLET=""      # for Vodafone Cash, Etisalat Cash
PAYMOB_IFRAME_ID=""                  # checkout iframe
PAYMOB_BASE_URL="https://accept.paymob.com/api"

# ETA (Egyptian Tax Authority) — v1.2
# These are حِسبة platform-level credentials; tenant-specific creds live in tenant_settings
ETA_PREPROD_BASE_URL="https://api.preprod.invoicing.eta.gov.eg"
ETA_PROD_BASE_URL="https://api.invoicing.eta.gov.eg"
ETA_ENCRYPTION_KEY=""                # AES-256 key to encrypt tenant_settings.eta_client_secret at rest

# Encryption key for sensitive tenant_settings fields (ETA secrets)
APP_ENCRYPTION_KEY=""                # 32-byte base64; used by encrypt/decrypt utility
```

## Docker Compose (Local Dev)
```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    container_name: hesba_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: hesba_master
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
    container_name: hesba_redis
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

## Production Stack
```
Railway:     API (Fastify) + PostgreSQL
Vercel:      React Frontend (free)
Upstash:     Redis (free tier → pay-as-go)
Cloudflare:  R2 storage + DNS + CDN
Resend:      Email (free 3000/month)
```

---

# 15. Default Seed Data

## Per-tenant Defaults (seeded on provisioning)
```typescript
// 5 System Roles → see Section 9

// 1 Main Branch
{ name: tenantName, isActive: true }

// Tenant Settings
{ currencyDefault: 'EGP', vatEnabled: false, language: 'ar', timezone: 'Africa/Cairo' }

// 6 Payment Methods → see Section 7

// 2 Tax Rates
[
  { name: 'بدون ضريبة', rate: 0.00, isDefault: true },
  { name: 'VAT 14%',    rate: 14.00, isDefault: false },
]

// 1 Base Currency
{ code: 'EGP', name: 'جنيه مصري', rateToBase: 1.000000, isBase: true }

// 6 Expense Categories
[
  { name: 'إيجار',            color: '#EF4444' },
  { name: 'كهرباء وماء',     color: '#F59E0B' },
  { name: 'رواتب',           color: '#3B82F6' },
  { name: 'صيانة',           color: '#10B981' },
  { name: 'تسويق',           color: '#8B5CF6' },
  { name: 'مصروفات متنوعة', color: '#64748B' },
]

// 1 Super Admin User (the owner)
{
  fullName: ownerName,
  email: ownerEmail,
  passwordHash: hashPassword(ownerPassword),
  branchId: mainBranch.id,
  roleId: superAdminRole.id,
  isActive: true,
}
```

## Master DB Seed (3 Plans)
```typescript
[
  {
    name: 'Starter', slug: 'starter',
    priceMonthly: 199, priceYearly: 1990,
    maxProducts: 100, maxOrders: 300, maxUsers: 3, maxStorage: 512,   // v1.2: maxUsers 2→3
    sortOrder: 1,
    features: {
      max_branches: 1, max_users: 3,                                  // v1.2: 2→3 (matches business doc)
      installments: false, multi_currency: false,
      suppliers: false, expenses: false,
      advanced_reports: false, offline_mode: false, api_access: false
    }
  },
  {
    name: 'Professional', slug: 'professional',
    priceMonthly: 499, priceYearly: 4990,
    maxProducts: 1000, maxOrders: 3000, maxUsers: 10, maxStorage: 5120,
    sortOrder: 2,
    features: {
      max_branches: 5, max_users: 15,
      installments: true, multi_currency: true,
      suppliers: true, expenses: true,
      advanced_reports: true, offline_mode: false, api_access: false
    }
  },
  {
    name: 'Enterprise', slug: 'enterprise',
    priceMonthly: 999, priceYearly: 9990,
    maxProducts: 999999, maxOrders: 999999, maxUsers: 999999, maxStorage: 102400,
    sortOrder: 3,
    features: {
      max_branches: -1, max_users: -1,
      installments: true, multi_currency: true,
      suppliers: true, expenses: true,
      advanced_reports: true, offline_mode: true, api_access: true
    }
  }
]
```

---

# 16. Implementation Steps

## Step 01 ⏳ NOT STARTED (v1.2 correction — earlier docs incorrectly marked it complete)
Project setup, monorepo, Docker, TypeScript, folder structure.

> **Phase 1 timeline (v1.2):** ~4 months total — was 3 months in v1.0 / v1.1, extended to accommodate ETA full integration (Step 09a, ~3 weeks) and Paymob billing (Step 09b, ~1 week).

## Step 02 — Master DB Schema + Prisma
**Task:** Setup Prisma for Master DB
1. Init `packages/database` with Prisma
2. Write `schema.prisma` for: plans, tenants, subscriptions
3. Run migration: `init_master_schema`
4. Seed 3 default plans
5. Connect `@hesba/api` to `@hesba/database`
6. Verify: `GET /health` and `GET /plans`

## Step 03 — Tenant Provisioning
**Task:** Multi-tenant foundation
1. `getTenantDb()` with client caching
2. `runTenantMigrations()` for tenant schema
3. `provisionTenant()` full flow
4. `POST /api/tenants/register` endpoint
5. Tenant middleware (subdomain → schema → Redis cache)
6. Feature guard middleware

## Step 04 — Auth System
**Task:** JWT authentication
1. `POST /api/auth/login` → Access Token + Refresh Cookie
2. `POST /api/auth/refresh` → new Access Token
3. `POST /api/auth/logout` → clear cookie
4. `authenticate` middleware
5. `requirePermission(resource, action)` middleware
6. Frontend: axios interceptors for auto-refresh

## Step 05 — Tenant Schema (All 36 Tables)  ← v1.2: was "33+", now 36 (variants + audit_logs + password_reset_tokens added)
**Task:** Full tenant database schema
1. Create Prisma schema for ALL tenant tables (see Section 4) — including v1.2 additions:
   - `product_variants` (every product gets at least one auto-default variant)
   - `audit_logs`
   - `password_reset_tokens`
2. Run tenant migration via the migration runner (Section 5)
3. Update `seedTenantDefaults()` with all seed data
4. For each existing seed product: auto-create one variant with `attributes = {}`
5. Test: provision tenant and verify all tables + seed data
6. Verify FK references go to `variant_id` (not `product_id`) on: stock, stock_movements, invoice_items, return_items, stock_transfer_items, purchase_order_items

## Step 06 — Core APIs: Products + Stock
**Task:** Product management and inventory
1. `GET/POST /api/products` + `GET/PATCH/DELETE /api/products/:id`
2. `GET /api/products/barcode/:code` — barcode lookup
3. `GET /api/stock` — current inventory per branch
4. `PATCH /api/stock/:productId` — manual adjustment
5. `GET /api/stock/movements` — history
6. `POST /api/stock/transfers` + approval flow

## Step 07 — POS + Invoices + Payment Fees
**Task:** Core selling functionality
1. `POST /api/invoices` — full transaction (stock, fee expense, coupon)
2. `GET /api/invoices` + `GET /api/invoices/:id`
3. Payment fee calculation (see Section 7)
4. Coupon validation and application
5. `GET /api/payment-methods` + CRUD for settings
6. Returns: `POST /api/invoices/:id/return`

## Step 08 — Installments
**Task:** Installment contract system
1. `POST /api/installments` — create contract (pending_approval)
2. `PATCH /api/installments/:id/approve` — manager approves (stock update happens here)
3. `PATCH /api/installments/:id/reject`
4. `POST /api/installments/:id/payment` — record payment
5. Exchange rate locking at contract creation

## Step 09 — Customers + Suppliers + Expenses
1. Full CRUD for customers + document upload
2. Full CRUD for suppliers + transaction recording
3. Purchase orders full flow (create → approve → receive → update stock)
4. Expenses with approval workflow + fee auto-expense

## Step 09a — ETA E-Invoicing Integration  ← NEW v1.2 (~3 weeks)
**Task:** Submit every invoice to the Egyptian Tax Authority for legal compliance.

### Prerequisites (must obtain BEFORE starting)
- ETA preprod portal account
- Activity classification code from ETA registration
- Each tenant's `eta_taxpayer_id` (RIN), client_id, client_secret
- Digital signing certificate (USB token recommended for first deploy; cloud HSM later)

### Deliverables
1. **`apps/api/src/modules/eta/`** module:
   - `eta.client.ts` — JWT auth with ETA, token refresh
   - `eta.payload.ts` — build ETA-canonical JSON from invoice + items + tenant_settings
   - `eta.signer.ts` — CAdES-BES detached signature using cert + private key
   - `eta.submit.ts` — POST to ETA, parse response, update `invoices.eta_*` and `eta_submissions`
   - `eta.qr.ts` — generate QR code data after acceptance
2. **BullMQ queue:** `eta-submission` — invoice creation enqueues a job; worker handles submission with exponential backoff (5 retries, then `eta_status = 'failed'`)
3. **Encryption utility:** `apps/api/src/shared/utils/encryption.ts` — AES-256-GCM using `APP_ENCRYPTION_KEY` for `tenant_settings.eta_client_secret` and `eta_client_id` at rest
4. **Tenant settings UI:** ETA configuration page (Super Admin only) — taxpayer ID, activity code, branch code, certificate upload
5. **Invoice flow change:** after invoice transaction commits, enqueue ETA job (don't block POS sale on ETA latency)
6. **Refund handling:** generate ETA credit note linked to original `eta_long_id`
7. **Receipt printing:** include ETA QR code on customer receipt
8. **Admin endpoint:** `POST /api/admin/eta/resubmit/:invoiceId` for manual retry of failed submissions

### Testing
- ETA preprod environment first (use ETA test taxpayer ID)
- Verify accepted, rejected, and timeout cases
- Verify signature validity with ETA's signature validator tool
- Switch to production only after preprod passes 100 sample invoices

## Step 09b — Paymob SaaS Billing  ← NEW v1.2 (~1 week)
**Task:** Tenants pay for their حِسبة subscription via Paymob.

### Prerequisites
- Paymob merchant account (production)
- API key, HMAC secret, integration IDs (card + wallet), iframe ID

### Deliverables
1. **`apps/api/src/modules/billing/`** module:
   - `paymob.client.ts` — Paymob auth token + order creation + payment key generation
   - `paymob.webhook.ts` — HMAC verification, status update, dunning trigger
   - `billing.service.ts` — subscription lifecycle (start trial, upgrade, downgrade, cancel)
   - `dunning.worker.ts` — BullMQ recurring job, retries on day 3/7/14, suspend on day 14, cancel on day 44
2. **Public endpoints:**
   - `POST /api/billing/checkout` — start a payment session, return Paymob iframe URL
   - `POST /api/billing/paymob/webhook` — receives Paymob status callbacks
   - `GET /api/billing/portal` — current subscription, invoices, update card
3. **Trial flow:** new tenant gets 14-day trial; on day 12, email reminder; on day 14, charge
4. **Card update flow:** Paymob saved-card token; user can update via iframe
5. **Plan changes:** prorate upgrade immediately, downgrade at next billing cycle
6. **Webhook idempotency:** `payment_attempts.provider_transaction_id` is unique; reject duplicate webhooks
7. **Reconciliation script:** daily cron that checks Paymob's transaction list against `payment_attempts` to catch missed webhooks
8. **Email triggers:** payment_succeeded, payment_failed, trial_ending, subscription_suspended, subscription_cancelled

### Testing
- Paymob sandbox mode for all test cases
- Test webhook HMAC verification with real Paymob test transactions
- Test full dunning cycle by failing payments deliberately
- Verify status transitions: TRIALING → ACTIVE → PAST_DUE → SUSPENDED → CANCELLED

## Step 10 — Reports + Dashboard
1. Dashboard stats (today sales, pending installments, low stock alerts)
2. Sales report with date range + filters + export
3. Stock report
4. Installments report (active, overdue, completed)
5. Payment fees report
6. Profit & Loss report

## Step 11 — Frontend Foundation
1. React setup with TailwindCSS + design tokens
2. Auth pages (Login + Register with plan selection)
3. Dashboard with stats + charts
4. Sidebar navigation

## Step 12 — Frontend POS
1. POS screen: product grid + cart + payment methods with fees
2. Installment contract creation flow
3. Customer search/create

## Step 13+ — Remaining Frontend Pages
Products, Stock, Customers, Suppliers, Expenses, Reports, Settings

---

# 17. Current Status

```
Step 01 ⏳ NOT STARTED — START HERE  (v1.2 correction: docs incorrectly marked it complete)
Step 02 ⏳ NOT STARTED — Master DB Schema + Prisma
Step 03 ⏳ NOT STARTED — Tenant Provisioning
Step 04 ⏳ NOT STARTED — Auth System (incl. password reset, v1.2)
Step 05 ⏳ NOT STARTED — Tenant Schema (36 tables incl. variants/audit/reset, v1.2)
Step 06 ⏳ NOT STARTED — Core APIs: Products + Stock
Step 07 ⏳ NOT STARTED — POS + Invoices + Payment Fees
Step 08 ⏳ NOT STARTED — Installments
Step 09  ⏳ NOT STARTED — Customers + Suppliers + Expenses
Step 09a ⏳ NOT STARTED — ETA E-Invoicing Integration  ← v1.2 NEW
Step 09b ⏳ NOT STARTED — Paymob SaaS Billing          ← v1.2 NEW
Step 10  ⏳ NOT STARTED — Reports + Dashboard
Step 11+ ⏳ NOT STARTED — Frontend
```

---

## START HERE — Your First Task

**Complete Step 02. Do the following in order:**

1. Navigate to `packages/database`
2. Run `pnpm init` and create `package.json` as shown in folder structure
3. Run `pnpm exec prisma init --datasource-provider postgresql`
4. Delete the auto-created `.env` inside `packages/database` (we use root `.env`)
5. Write `prisma/schema.prisma` for Master DB: plans, tenants, subscriptions (exact schema in Section 4)
6. Configure `generator client` output to `../src/generated/client`
7. Run `pnpm db:generate` → `pnpm db:migrate` (name it: `init_master_schema`)
8. Create `src/prisma.ts` singleton client
9. Create `src/index.ts` to export types
10. Create `src/seeds/master.seed.ts` with 3 plans (exact data in Section 15)
11. Run `pnpm db:seed` and verify 3 plans in DB
12. Add `@hesba/database: workspace:*` to `apps/api/package.json`
13. Run `pnpm install` from root
14. Update `apps/api/src/index.ts` to add:
    - `GET /health` → `{ status: 'ok', timestamp }`
    - `GET /plans` → return all active plans from DB
15. Start server with `pnpm dev:api`
16. Test: `curl http://localhost:3000/health` and `curl http://localhost:3000/plans`

When done, report:
- All files created ✅
- Migration ran successfully ✅
- 3 plans seeded ✅
- Both endpoints working ✅
- No TypeScript errors ✅

Then immediately start Step 03 without waiting.

---

*حِسبة COMPLETE CONTEXT v1.1 — أبريل 2026*
*This file contains EVERYTHING — no other source needed*
