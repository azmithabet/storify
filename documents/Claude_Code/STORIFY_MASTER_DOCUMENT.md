# STORIFY — Master Technical Document
> نظام إدارة مخازن ومحال تجارية — SaaS Multi-tenant
> **آخر تحديث:** 2026-05-10 (v1.2 patches applied)
> **الحالة:** Step 1 لم يبدأ — اقرأ `Storify_Patch_Notes_v1.2.md` قبل أي كود
>
> **⚠️ v1.2 changes:** This file pre-dates v1.2 patches. The canonical reference is `STORIFY_COMPLETE_CONTEXT.md` v1.2 + `Storify_Patch_Notes_v1.2.md`. Critical deltas applied below: bcrypt password hashing, decimal.js dependency, payment_method_id (not payment_type) in invoices.

---

# فهرس المحتويات

1. [نظرة عامة على المشروع](#1-نظرة-عامة)
2. [الـ Tech Stack والقرارات التقنية](#2-tech-stack)
3. [الـ Architecture](#3-architecture)
4. [Database Schema الكامل](#4-database-schema)
5. [الأدوار والصلاحيات](#5-roles--permissions)
6. [نظام التقسيط](#6-نظام-التقسيط)
7. [Multi-tenant Architecture](#7-multi-tenant)
8. [الـ SaaS Plans](#8-saas-plans)
9. [Hosting & Infrastructure](#9-hosting--infrastructure)
10. [خطة التنفيذ — المراحل الثلاثة](#10-خطة-التنفيذ)
11. [Step-by-Step Implementation Guide](#11-implementation-guide)
    - [Step 01 — Project Setup](#step-01--project-setup)
    - [Step 02 — Master DB Schema + Prisma](#step-02--master-db-schema)
    - [Step 03 — Tenant Provisioning](#step-03--tenant-provisioning)
    - [Step 04 — Auth System](#step-04--auth-system)
    - [Step 05 — Tenant Schema & Core Tables](#step-05--tenant-schema)
    - [Step 06 — Core APIs](#step-06--core-apis)
    - [Step 07 — Frontend Foundation](#step-07--frontend-foundation)

---

# 1. نظرة عامة

## المشروع
نظام SaaS لإدارة المخازن والمحال التجارية. كل عميل (tenant) بيشتغل على بياناته المنعزلة تماماً عن باقي العملاء.

## نوع المحلات المستهدفة
- محلات تجزئة (ملابس، إلكترونيات، إلخ)
- قابل للتوسع لأنواع أخرى

## الـ Business Model
- SaaS — اشتراك شهري/سنوي
- 3 باقات: Starter / Professional / Enterprise
- كل عميل على database schema منفصل (Isolated Multi-tenant)

---

# 2. Tech Stack

## القرارات النهائية

| الطبقة | الاختيار | السبب |
|---|---|---|
| **Frontend** | React + Vite + TailwindCSS | سريع، مرن، مجتمع ضخم |
| **Backend** | Fastify + TypeScript | أسرع من Express، TypeScript native، مناسب للـ multi-tenant |
| **ORM** | Prisma | Type-safe queries، migrations سهلة، schema واضح |
| **Database** | PostgreSQL | Schemas للـ tenant isolation، NUMERIC للمالية، JSONB للـ settings |
| **Cache** | Redis (Upstash) | Sessions، rate limiting، BullMQ queue |
| **Queue** | BullMQ | PDF generation، SMS، reports |
| **Storage** | Cloudflare R2 | صور المنتجات، عقود PDF، إيصالات (مجاني لأول 10GB) |
| **Email/SMS** | Resend + Vonage | تنبيهات الأقساط، إشعارات المخزون |
| **Hosting API** | Railway | Node.js + PostgreSQL جاهزين، wildcard subdomains |
| **Hosting Web** | Vercel | مجاني، سريع للـ static React |
| **DNS** | Cloudflare | Wildcard subdomains مجاناً |
| **Monorepo** | pnpm workspaces | مشاركة types بين Frontend وBackend |

## ليه Fastify وليه PostgreSQL؟

**Fastify:**
- Event Loop يخدم آلاف الـ requests في نفس الوقت (مهم للـ multi-tenant)
- WebSockets native للـ offline sync
- نفس لغة الـ Frontend (TypeScript)
- Railway بيدعمه out of the box

**PostgreSQL:**
- Schemas = عزل بيانات كل عميل بدون databases منفصلة
- NUMERIC(15,4) للأرقام المالية بدون floating point errors
- JSONB للـ permissions والـ settings
- ACID transactions للعمليات المالية المعقدة

---

# 3. Architecture

## الصورة الكاملة

```
                    ┌─────────────────────────────────────┐
                    │         Cloudflare DNS               │
                    │   *.storify.com → Railway API        │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    store1.storify.com   store2.storify.com    admin.storify.com
              │                    │                    │
              └────────────────────┼────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │      Fastify API (Railway)            │
                    │                                      │
                    │  Tenant Middleware                   │
                    │  → يعرف هو بيكلم أنهي tenant        │
                    │  → يفتحله الـ schema بتاعه           │
                    └──┬───────────┬───────────┬──────────┘
                       │           │           │
              ┌────────▼──┐  ┌─────▼────┐  ┌──▼──────────┐
              │ Master DB │  │Tenant DB │  │    Redis     │
              │           │  │          │  │              │
              │ tenants   │  │ tenant_  │  │ Sessions     │
              │ plans     │  │ abc.*    │  │ BullMQ Queue │
              │ subscript │  │ tenant_  │  │ Rate Limit   │
              │ ions      │  │ xyz.*    │  └─────────────┘
              └───────────┘  └──────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │        Cloudflare R2                  │
                    │   صور + PDFs + إيصالات + عقود        │
                    └─────────────────────────────────────┘
```

## Tenant Middleware — إزاي بيشتغل

```
Request → store1.storify.com/api/products
       ↓
Tenant Middleware:
  1. بياخد الـ subdomain: "store1"
  2. بيدور عليه في Master DB
  3. بيفتح connection لـ schema بتاعه: "tenant_store1"
  4. بيحط الـ db connection في req.tenant
       ↓
Route Handler بيشتغل على بيانات store1 بس
```

---

# 4. Database Schema

## Master DB — جداول إدارة النظام

### plans
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
name          VARCHAR(100) NOT NULL          -- "Starter", "Professional", "Enterprise"
slug          VARCHAR(50) UNIQUE NOT NULL    -- "starter", "professional", "enterprise"
price_monthly NUMERIC(10,2) NOT NULL
price_yearly  NUMERIC(10,2) NOT NULL
features      JSONB NOT NULL                 -- {"max_branches": 1, "installments": false, ...}
is_active     BOOLEAN DEFAULT true
created_at    TIMESTAMPTZ DEFAULT NOW()
```

**مثال features JSON:**
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
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
name          VARCHAR(200) NOT NULL
subdomain     VARCHAR(100) UNIQUE NOT NULL   -- "store1" في store1.storify.com
schema_name   VARCHAR(100) UNIQUE NOT NULL   -- "tenant_abc123"
plan_id       UUID REFERENCES plans(id)
is_active     BOOLEAN DEFAULT true
trial_ends_at TIMESTAMPTZ
created_at    TIMESTAMPTZ DEFAULT NOW()
updated_at    TIMESTAMPTZ DEFAULT NOW()
```

### subscriptions
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id      UUID REFERENCES tenants(id)
plan_id        UUID REFERENCES plans(id)
status         VARCHAR(50)                   -- active, cancelled, past_due, trialing
billing_cycle  VARCHAR(20)                   -- monthly, yearly
amount         NUMERIC(10,2)
started_at     TIMESTAMPTZ
ends_at        TIMESTAMPTZ
cancelled_at   TIMESTAMPTZ
created_at     TIMESTAMPTZ DEFAULT NOW()
```

---

## Tenant Schema — جداول كل عميل

> كل الجداول دي بتتعمل في schema منفصل لكل عميل: `tenant_{id}.*`

### tenant_settings
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
currency_default  VARCHAR(10) DEFAULT 'EGP'
vat_enabled       BOOLEAN DEFAULT false
logo_url          TEXT
print_template    TEXT
language          VARCHAR(10) DEFAULT 'ar'
timezone          VARCHAR(50) DEFAULT 'Africa/Cairo'
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

### branches
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        VARCHAR(200) NOT NULL
address     TEXT
phone       VARCHAR(50)
is_active   BOOLEAN DEFAULT true
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### roles
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        VARCHAR(100) NOT NULL
slug        VARCHAR(50) UNIQUE NOT NULL
permissions JSONB NOT NULL DEFAULT '{}'
is_system   BOOLEAN DEFAULT false    -- الأدوار الافتراضية مش ممكن تتحذف
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### users
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
branch_id     UUID REFERENCES branches(id)
role_id       UUID REFERENCES roles(id)
full_name     VARCHAR(200) NOT NULL
email         VARCHAR(255) UNIQUE NOT NULL
password_hash TEXT NOT NULL
is_active     BOOLEAN DEFAULT true
last_login    TIMESTAMPTZ
created_at    TIMESTAMPTZ DEFAULT NOW()
updated_at    TIMESTAMPTZ DEFAULT NOW()
```

### categories
```sql
id        UUID PRIMARY KEY DEFAULT gen_random_uuid()
name      VARCHAR(200) NOT NULL
parent_id UUID REFERENCES categories(id)    -- للتصنيفات المتداخلة
is_active BOOLEAN DEFAULT true
```

### tax_rates
```sql
id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
name       VARCHAR(100) NOT NULL    -- "VAT 14%", "VAT 0%"
rate       NUMERIC(5,2) NOT NULL    -- 14.00
is_default BOOLEAN DEFAULT false
is_active  BOOLEAN DEFAULT true
```

### products
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
category_id   UUID REFERENCES categories(id)
tax_rate_id   UUID REFERENCES tax_rates(id)
name          VARCHAR(300) NOT NULL
barcode       VARCHAR(100)
unit          VARCHAR(50) DEFAULT 'piece'    -- piece, kg, liter, etc.
cost_price    NUMERIC(15,4) NOT NULL
sell_price    NUMERIC(15,4) NOT NULL
image_url     TEXT
is_active     BOOLEAN DEFAULT true
created_at    TIMESTAMPTZ DEFAULT NOW()
updated_at    TIMESTAMPTZ DEFAULT NOW()
```

### stock
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
product_id   UUID REFERENCES products(id)
branch_id    UUID REFERENCES branches(id)
quantity     INTEGER NOT NULL DEFAULT 0
min_quantity INTEGER NOT NULL DEFAULT 0    -- تنبيه نفاد المخزون
updated_at   TIMESTAMPTZ DEFAULT NOW()
UNIQUE(product_id, branch_id)
```

### stock_movements
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
product_id  UUID REFERENCES products(id)
branch_id   UUID REFERENCES branches(id)
user_id     UUID REFERENCES users(id)
type        VARCHAR(50) NOT NULL    -- in, out, transfer, adjustment, return
quantity    INTEGER NOT NULL
note        TEXT
reference   TEXT                    -- رقم الفاتورة أو الـ PO
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### stock_transfers
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
from_branch_id  UUID REFERENCES branches(id)
to_branch_id    UUID REFERENCES branches(id)
created_by      UUID REFERENCES users(id)
approved_by     UUID REFERENCES users(id)
status          VARCHAR(50) DEFAULT 'pending'    -- pending, approved, rejected, completed
notes           TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

### stock_transfer_items
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
transfer_id UUID REFERENCES stock_transfers(id)
product_id  UUID REFERENCES products(id)
quantity    INTEGER NOT NULL
```

### currencies
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
code         VARCHAR(10) UNIQUE NOT NULL    -- EGP, USD, EUR
name         VARCHAR(100) NOT NULL
rate_to_base NUMERIC(15,6) NOT NULL         -- سعر الصرف مقابل الجنيه
is_base      BOOLEAN DEFAULT false
updated_at   TIMESTAMPTZ DEFAULT NOW()
```

### customers
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
full_name   VARCHAR(200) NOT NULL
phone       VARCHAR(50)
national_id VARCHAR(50)
address     TEXT
notes       TEXT
credit_balance NUMERIC(15,4) DEFAULT 0    -- رصيد المرتجعات
created_at  TIMESTAMPTZ DEFAULT NOW()
updated_at  TIMESTAMPTZ DEFAULT NOW()
```

### customer_documents
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id  UUID REFERENCES customers(id)
doc_type     VARCHAR(100) NOT NULL    -- national_id_front, national_id_back, signature, receipt
file_url     TEXT NOT NULL
uploaded_by  UUID REFERENCES users(id)
uploaded_at  TIMESTAMPTZ DEFAULT NOW()
```

### coupons
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
code            VARCHAR(100) UNIQUE NOT NULL
discount_type   VARCHAR(20) NOT NULL    -- percentage, fixed
discount_value  NUMERIC(10,2) NOT NULL
min_amount      NUMERIC(15,4)
max_uses        INTEGER
used_count      INTEGER DEFAULT 0
expires_at      TIMESTAMPTZ
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### product_discounts
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
product_id     UUID REFERENCES products(id)
discount_type  VARCHAR(20) NOT NULL    -- percentage, fixed
discount_value NUMERIC(10,2) NOT NULL
start_date     DATE NOT NULL
end_date       DATE NOT NULL
is_active      BOOLEAN DEFAULT true
```

### invoices  ← v1.2: payment_type replaced by payment_method_id (FK→payment_methods)
```sql
id                 UUID PRIMARY KEY DEFAULT gen_random_uuid()
branch_id          UUID REFERENCES branches(id)
customer_id        UUID REFERENCES customers(id)
cashier_id         UUID REFERENCES users(id)
currency_id        UUID REFERENCES currencies(id)
coupon_id          UUID REFERENCES coupons(id)
payment_method_id  UUID REFERENCES payment_methods(id)   -- v1.2: replaces payment_type string
exchange_rate      NUMERIC(15,6) DEFAULT 1
subtotal           NUMERIC(15,4) NOT NULL
discount_amount    NUMERIC(15,4) DEFAULT 0
tax_total          NUMERIC(15,4) DEFAULT 0
fee_percentage     NUMERIC(5,2)  DEFAULT 0    -- v1.1: locked at sale time
fee_fixed          NUMERIC(10,2) DEFAULT 0    -- v1.1
fee_amount         NUMERIC(15,4) DEFAULT 0    -- v1.1: calculated fee
fee_bearer         VARCHAR(20) DEFAULT 'merchant'  -- v1.1: customer | merchant
fee_added_to_total BOOLEAN DEFAULT false      -- v1.1: true = customer pays fee
total_amount       NUMERIC(15,4) NOT NULL
paid_amount        NUMERIC(15,4) DEFAULT 0
status             VARCHAR(50) DEFAULT 'completed'    -- completed, refunded, partial_refund
notes              TEXT
created_at         TIMESTAMPTZ DEFAULT NOW()
```
> See full payment-method semantics in `Storify_Payment_Fees_Update.md` and `STORIFY_COMPLETE_CONTEXT.md` Section 7.

### invoice_items
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
invoice_id      UUID REFERENCES invoices(id)
product_id      UUID REFERENCES products(id)
quantity        INTEGER NOT NULL
unit_price      NUMERIC(15,4) NOT NULL
discount_amount NUMERIC(15,4) DEFAULT 0
tax_rate_id     UUID REFERENCES tax_rates(id)
tax_amount      NUMERIC(15,4) DEFAULT 0
subtotal        NUMERIC(15,4) NOT NULL
```

### installment_contracts
```sql
id                      UUID PRIMARY KEY DEFAULT gen_random_uuid()
invoice_id              UUID REFERENCES invoices(id)
customer_id             UUID REFERENCES customers(id)
approved_by             UUID REFERENCES users(id)
currency_id             UUID REFERENCES currencies(id)
exchange_rate_at_contract NUMERIC(15,6) DEFAULT 1
down_payment            NUMERIC(15,4) NOT NULL
installments_count      INTEGER NOT NULL
monthly_amount          NUMERIC(15,4) NOT NULL
interest_rate           NUMERIC(5,2) DEFAULT 0
total_amount            NUMERIC(15,4) NOT NULL
first_due_date          DATE NOT NULL
status                  VARCHAR(50) DEFAULT 'pending_approval'
guarantor_name          VARCHAR(200)
guarantor_phone         VARCHAR(50)
signature_url           TEXT
notes                   TEXT
created_at              TIMESTAMPTZ DEFAULT NOW()
updated_at              TIMESTAMPTZ DEFAULT NOW()
```

> **ملاحظة:** status = 'pending_approval' لحد ما المدير يوافق. لو ما وافقش، البيع ما يكملش.

### installment_payments
```sql
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
contract_id         UUID REFERENCES installment_contracts(id)
received_by         UUID REFERENCES users(id)
installment_number  INTEGER NOT NULL
amount_paid         NUMERIC(15,4) NOT NULL
due_date            DATE NOT NULL
paid_date           DATE
receipt_url         TEXT
status              VARCHAR(50) DEFAULT 'pending'    -- pending, paid, overdue
created_at          TIMESTAMPTZ DEFAULT NOW()
```

### external_financing
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
invoice_id     UUID REFERENCES invoices(id)
company_name   VARCHAR(200) NOT NULL    -- Valu, Sympl, إلخ
reference_no   VARCHAR(200)
commission_pct NUMERIC(5,2) DEFAULT 0
created_at     TIMESTAMPTZ DEFAULT NOW()
```

### returns
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
invoice_id  UUID REFERENCES invoices(id)
processed_by UUID REFERENCES users(id)
return_type VARCHAR(20) NOT NULL    -- refund, credit
amount      NUMERIC(15,4) NOT NULL
reason      TEXT
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### return_items
```sql
id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
return_id  UUID REFERENCES returns(id)
product_id UUID REFERENCES products(id)
quantity   INTEGER NOT NULL
restock    BOOLEAN DEFAULT true    -- هل البضاعة ترجع للمخزون؟
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
balance      NUMERIC(15,4) DEFAULT 0    -- موجب = المورد ليه فلوس، سالب = احنا مديونين
notes        TEXT
is_active    BOOLEAN DEFAULT true
created_at   TIMESTAMPTZ DEFAULT NOW()
```

### supplier_transactions
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
supplier_id UUID REFERENCES suppliers(id)
branch_id   UUID REFERENCES branches(id)
user_id     UUID REFERENCES users(id)
type        VARCHAR(50) NOT NULL    -- payment, purchase, return
amount      NUMERIC(15,4) NOT NULL
reference   TEXT
note        TEXT
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### purchase_orders
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
supplier_id    UUID REFERENCES suppliers(id)
branch_id      UUID REFERENCES branches(id)
created_by     UUID REFERENCES users(id)
approved_by    UUID REFERENCES users(id)
status         VARCHAR(50) DEFAULT 'draft'    -- draft, pending, approved, received, cancelled
total_amount   NUMERIC(15,4) NOT NULL
paid_amount    NUMERIC(15,4) DEFAULT 0
payment_type   VARCHAR(50)
expected_date  DATE
created_at     TIMESTAMPTZ DEFAULT NOW()
updated_at     TIMESTAMPTZ DEFAULT NOW()
```

### purchase_order_items
```sql
id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id   UUID REFERENCES purchase_orders(id)
product_id UUID REFERENCES products(id)
quantity   INTEGER NOT NULL
unit_cost  NUMERIC(15,4) NOT NULL
subtotal   NUMERIC(15,4) NOT NULL
```

### purchase_receipts
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id          UUID REFERENCES purchase_orders(id)
received_by       UUID REFERENCES users(id)
received_date     DATE NOT NULL
notes             TEXT
invoice_image_url TEXT
created_at        TIMESTAMPTZ DEFAULT NOW()
```

### purchase_payments
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
order_id       UUID REFERENCES purchase_orders(id)
supplier_id    UUID REFERENCES suppliers(id)
paid_by        UUID REFERENCES users(id)
amount         NUMERIC(15,4) NOT NULL
payment_method VARCHAR(50)
receipt_url    TEXT
paid_at        TIMESTAMPTZ DEFAULT NOW()
```

### expense_categories
```sql
id        UUID PRIMARY KEY DEFAULT gen_random_uuid()
name      VARCHAR(200) NOT NULL    -- إيجار، كهرباء، رواتب، صيانة
color     VARCHAR(20)
is_active BOOLEAN DEFAULT true
```

### expenses
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
branch_id       UUID REFERENCES branches(id)
category_id     UUID REFERENCES expense_categories(id)
created_by      UUID REFERENCES users(id)
approved_by     UUID REFERENCES users(id)
description     TEXT NOT NULL
amount          NUMERIC(15,4) NOT NULL
payment_method  VARCHAR(50)
receipt_url     TEXT
expense_date    DATE NOT NULL
status          VARCHAR(50) DEFAULT 'pending'    -- pending, approved, rejected
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### offline_queue
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
action_type VARCHAR(100) NOT NULL    -- create_invoice, update_stock, إلخ
payload     JSONB NOT NULL
created_at  TIMESTAMPTZ NOT NULL
synced_at   TIMESTAMPTZ
conflict    BOOLEAN DEFAULT false
conflict_data JSONB
```

### print_templates
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
type          VARCHAR(100) NOT NULL    -- invoice, contract, receipt
name          VARCHAR(200) NOT NULL
html_template TEXT NOT NULL
is_default    BOOLEAN DEFAULT false
created_at    TIMESTAMPTZ DEFAULT NOW()
```

---

# 5. Roles & Permissions

## الأدوار الخمسة الافتراضية

### 1. Super Admin
```json
{
  "branches": ["create", "read", "update", "delete"],
  "users": ["create", "read", "update", "delete"],
  "products": ["create", "read", "update", "delete"],
  "stock": ["read", "update", "transfer"],
  "invoices": ["create", "read", "update", "delete"],
  "installments": ["create", "read", "approve", "update"],
  "suppliers": ["create", "read", "update", "delete"],
  "purchases": ["create", "read", "approve"],
  "expenses": ["create", "read", "approve"],
  "reports": ["read", "export"],
  "settings": ["read", "update"]
}
```

### 2. Branch Manager
```json
{
  "branches": ["read"],
  "users": ["create", "read", "update"],
  "products": ["create", "read", "update"],
  "stock": ["read", "update", "transfer"],
  "invoices": ["create", "read", "update"],
  "installments": ["create", "read", "approve"],
  "suppliers": ["read"],
  "purchases": ["create", "read"],
  "expenses": ["create", "read", "approve"],
  "reports": ["read", "export"],
  "settings": ["read"]
}
```

### 3. Cashier
```json
{
  "products": ["read"],
  "stock": ["read"],
  "invoices": ["create", "read"],
  "installments": ["create"],
  "customers": ["create", "read", "update"],
  "reports": []
}
```
> التقسيط بيتعمل من الكاشير لكن status = 'pending_approval' لحد ما المدير يوافق

### 4. Inventory Keeper
```json
{
  "products": ["create", "read", "update"],
  "stock": ["read", "update", "transfer"],
  "purchases": ["create", "read"],
  "suppliers": ["read"],
  "reports": ["read"]
}
```

### 5. Accountant
```json
{
  "invoices": ["read"],
  "installments": ["read", "update"],
  "expenses": ["read"],
  "suppliers": ["read"],
  "purchases": ["read"],
  "reports": ["read", "export"]
}
```

---

# 6. نظام التقسيط

## التقسيط الداخلي — Flow كامل

```
الكاشير يضغط "بيع بالتقسيط"
        ↓
إدخال بيانات العميل (لو جديد: صورة بطاقة + توقيع)
        ↓
إدخال بيانات العقد:
  - المقدم (مبلغ أو %)
  - عدد الأقساط
  - تاريخ أول قسط
  - الضامن (اختياري)
  - الفائدة (اختياري)
        ↓
النظام بيحسب: قيمة القسط الشهري = (الإجمالي - المقدم + الفائدة) / عدد الأقساط
        ↓
status = 'pending_approval'  ← البيع مش مكتمل
        ↓
إشعار للمدير بالموافقة
        ↓
المدير يوافق → status = 'active' → البيع مكتمل + طباعة العقد PDF
المدير يرفض → البيع ملغي
```

## حقل exchange_rate_at_contract
لو العقد بالدولار، بنحفظ سعر الصرف وقت العقد. الأقساط بتتحسب بالسعر ده مش بسعر الصرف الجديد.

## التقسيط الخارجي
البيع بيتسجل كـ cash في النظام. بس بنحفظ: اسم شركة التمويل + رقم مرجعي + عمولة%.

---

# 7. Multi-tenant Architecture

## إزاي بيشتغل

```
نظام واحد → عملاء لا نهاية
كل عميل عنده:
  - subdomain خاص: store1.storify.com
  - PostgreSQL schema منفصل: tenant_store1
  - بياناته معزولة 100%
```

## Tenant Middleware (Pseudocode)

```typescript
async function tenantMiddleware(request, reply) {
  // 1. استخرج الـ subdomain
  const subdomain = request.hostname.split('.')[0]

  // 2. دور على الـ tenant في Master DB
  const tenant = await masterDb.tenants.findUnique({
    where: { subdomain },
    include: { plan: true }
  })

  if (!tenant || !tenant.is_active) {
    return reply.status(404).send({ error: 'tenant_not_found' })
  }

  // 3. اتحقق من الاشتراك
  if (isSubscriptionExpired(tenant)) {
    return reply.status(402).send({ error: 'subscription_expired' })
  }

  // 4. افتح connection للـ schema بتاع الـ tenant
  request.tenant = tenant
  request.db = getPrismaClient(tenant.schema_name)
}
```

## Feature Guard (Pseudocode)

```typescript
function requireFeature(feature: string) {
  return async (request, reply) => {
    const features = request.tenant.plan.features
    if (!features[feature]) {
      return reply.status(403).send({
        error: 'upgrade_required',
        feature,
        upgrade_url: '/billing/upgrade'
      })
    }
  }
}

// الاستخدام:
app.post('/installments',
  { preHandler: [authenticate, requireFeature('installments')] },
  createInstallmentHandler
)
```

## Tenant Provisioning — لما عميل جديد يشترك

```typescript
async function provisionTenant(data) {
  // 1. إنشاء الـ tenant في Master DB
  const tenant = await masterDb.tenants.create({ data })

  // 2. إنشاء PostgreSQL Schema
  await masterDb.$executeRaw`CREATE SCHEMA ${tenant.schema_name}`

  // 3. تشغيل الـ migrations على الـ schema الجديد
  await runTenantMigrations(tenant.schema_name)

  // 4. إنشاء البيانات الافتراضية
  const db = getPrismaClient(tenant.schema_name)
  await seedTenantDefaults(db)

  return tenant
}
```

---

# 8. SaaS Plans

## الباقات

| الميزة | Starter | Professional | Enterprise |
|---|---|---|---|
| **السعر/شهر** | 199 ج | 499 ج | 999 ج |
| **الفروع** | 1 | 5 | ∞ |
| **المستخدمين** | 3 | 15 | ∞ |
| **نقطة البيع** | ✓ | ✓ | ✓ |
| **المخزون** | ✓ | ✓ | ✓ |
| **التقسيط الداخلي** | ✗ | ✓ | ✓ |
| **عملات متعددة** | ✗ | ✓ | ✓ |
| **موردين ومشتريات** | ✗ | ✓ | ✓ |
| **مصروفات** | ✗ | ✓ | ✓ |
| **تقارير متقدمة** | ✗ | ✓ | ✓ |
| **أوف لاين** | ✗ | ✗ | ✓ |
| **API Access** | ✗ | ✗ | ✓ |

---

# 9. Hosting & Infrastructure

## الـ Setup الكامل

```
Railway (~$20/شهر)
  ├── Fastify API Service
  └── PostgreSQL Database
      ├── storify_master (Master DB)
      ├── tenant_abc (Schema)
      ├── tenant_xyz (Schema)
      └── tenant_... (Schema)

Vercel (مجاني)
  └── React Frontend

Upstash Redis (مجاني لأول 10k req)
  ├── Sessions
  ├── Rate Limiting
  └── BullMQ Queue

Cloudflare R2 (مجاني لأول 10GB)
  ├── صور المنتجات
  ├── عقود PDF
  ├── صور البطاقات
  └── إيصالات الأقساط

Cloudflare DNS (مجاني)
  └── *.storify.com → Railway API
```

## ليه مش Shared Hosting؟

Shared Hosting (Hostinger وغيره) مش بيدعم:
- Node.js كـ persistent process
- PostgreSQL Schemas (في MySQL بس)
- Wildcard Subdomains
- WebSockets للـ offline sync
- Background Jobs (BullMQ)

---

# 10. خطة التنفيذ

## المرحلة الأولى — الأساس (3 أشهر)
- ✅ Project Setup & Architecture
- ✅ Multi-tenant Foundation
- ✅ Auth System (JWT + Roles)
- ✅ إدارة المنتجات + الباركود
- ✅ نقطة البيع (كاش + كارت + تقسيط)
- ✅ إدارة العملاء + المستندات
- ✅ التقسيط الداخلي (موافقة مدير + PDF)
- ✅ إدارة الفروع + المستخدمين
- ✅ تقارير أساسية + Dashboard

## المرحلة الثانية — التطوير (3 أشهر)
- الموردون + فواتير الشراء
- المصروفات
- عملات متعددة
- تحويل مخزون بين الفروع
- التقسيط الخارجي (Valu/Sympl)
- تقارير متقدمة + Excel/PDF export

## المرحلة الثالثة — التوسع (3 أشهر)
- أوف لاين (PWA + IndexedDB + Sync)
- تنبيهات ذكية (SMS + Email)
- قوالب طباعة مخصصة لكل فرع
- تطبيق موبايل
- AI features (توقع الطلب)

---

# 11. Implementation Guide

---

## Step 01 — Project Setup

### المتطلبات
```bash
node -v        # 20.x أو أحدث
pnpm -v        # 8.x أو أحدث
git --version
docker -v
```

لو pnpm مش موجود:
```bash
npm install -g pnpm
```

### إنشاء الـ Monorepo
```bash
mkdir storify && cd storify
git init
pnpm init
```

### الـ Folder Structure
```bash
mkdir -p apps/api/src/{config,modules,shared,types}
mkdir -p apps/api/src/modules/{auth,tenants,users}
mkdir -p apps/web/src
mkdir -p packages/shared/src/{types,utils,constants}
mkdir -p packages/database/src/{migrations,seeds}
mkdir -p infrastructure/docker
touch pnpm-workspace.yaml
touch .gitignore
touch .env.example
touch docker-compose.yml
```

### pnpm-workspace.yaml
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### .gitignore
```gitignore
node_modules/
.pnpm-store/
.env
.env.local
dist/
build/
*.log
.DS_Store
.idea/
coverage/
*.db
```

### .env.example
```env
DATABASE_MASTER_URL="postgresql://postgres:password@localhost:5432/storify_master"
REDIS_URL="redis://localhost:6379"
JWT_ACCESS_SECRET="change-this-in-production-min-32-chars"
JWT_REFRESH_SECRET="change-this-too-in-production-min-32-chars"
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

# Paymob (SaaS billing) — v1.2
PAYMOB_API_KEY=""
PAYMOB_HMAC_SECRET=""
PAYMOB_INTEGRATION_ID_CARD=""
PAYMOB_INTEGRATION_ID_WALLET=""
PAYMOB_IFRAME_ID=""
PAYMOB_BASE_URL="https://accept.paymob.com/api"

# ETA (Egyptian Tax Authority) — v1.2
ETA_PREPROD_BASE_URL="https://api.preprod.invoicing.eta.gov.eg"
ETA_PROD_BASE_URL="https://api.invoicing.eta.gov.eg"
ETA_ENCRYPTION_KEY=""
APP_ENCRYPTION_KEY=""
```

### docker-compose.yml
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

  redis:
    image: redis:7-alpine
    container_name: storify_redis
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### apps/api/package.json
```json
{
  "name": "@storify/api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
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
    "dayjs": "^1.11.10",
    "nanoid": "^5.0.6",
    "bcryptjs": "^2.4.3",
    "decimal.js": "^10.4.3",
    "lru-cache": "^10.2.0"
  },
  "devDependencies": {
    "typescript": "^5.4.2",
    "tsx": "^4.7.1",
    "prisma": "^5.10.2",
    "@types/node": "^20.11.24",
    "@types/bcryptjs": "^2.4.6",
    "pino-pretty": "^11.0.0"
  }
}
```
> v1.2: added `bcryptjs` (password hashing — replaces SHA-256), `decimal.js` (financial math — required by all calculation snippets), `lru-cache` (tenant client eviction).

### apps/api/tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### apps/api/src/config/env.ts
```typescript
import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config({ path: '../../.env' })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().url(),
  DATABASE_MASTER_URL: z.string(),
  REDIS_URL: z.string(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data
```

### apps/api/src/index.ts
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

app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

const start = async () => {
  try {
    await app.listen({ port: config.API_PORT, host: config.API_HOST })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
```

### الـ Root package.json
```json
{
  "name": "storify",
  "private": true,
  "scripts": {
    "dev:api": "pnpm --filter @storify/api dev",
    "dev:web": "pnpm --filter @storify/web dev",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down"
  }
}
```

### تشغيل وتأكيد
```bash
docker-compose up -d
cd apps/api && pnpm install
cp ../../.env.example ../../.env   # وعدّل القيم
pnpm dev
# المفروض تشوف: Server running on port 3000
```

### Git Commit
```bash
git add .
git commit -m "chore: initial project setup — monorepo, fastify, typescript, docker"
```

### Checklist
- [ ] Folder structure اتعملت
- [ ] `pnpm install` بدون errors
- [ ] Docker services شغالين
- [ ] Server على port 3000
- [ ] أول commit على GitHub

---

## Step 02 — Master DB Schema

### تثبيت Prisma
```bash
cd packages/database
pnpm init
pnpm add prisma @prisma/client
pnpm prisma init --datasource-provider postgresql
```

### packages/database/package.json
```json
{
  "name": "@storify/database",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "db:seed": "tsx src/seeds/master.seed.ts",
    "db:generate": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "^5.10.2"
  },
  "devDependencies": {
    "prisma": "^5.10.2",
    "typescript": "^5.4.2",
    "tsx": "^4.7.1",
    "@types/node": "^20.11.24"
  }
}
```

### packages/database/prisma/schema.prisma
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_MASTER_URL")
}

model Plan {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name          String   @db.VarChar(100)
  slug          String   @unique @db.VarChar(50)
  priceMonthly  Decimal  @map("price_monthly") @db.Decimal(10, 2)
  priceYearly   Decimal  @map("price_yearly") @db.Decimal(10, 2)
  features      Json
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz
  tenants       Tenant[]
  subscriptions Subscription[]

  @@map("plans")
}

model Tenant {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name         String   @db.VarChar(200)
  subdomain    String   @unique @db.VarChar(100)
  schemaName   String   @unique @map("schema_name") @db.VarChar(100)
  planId       String   @map("plan_id") @db.Uuid
  plan         Plan     @relation(fields: [planId], references: [id])
  isActive     Boolean  @default(true) @map("is_active")
  trialEndsAt  DateTime? @map("trial_ends_at") @db.Timestamptz
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz
  subscriptions Subscription[]

  @@map("tenants")
}

model Subscription {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  planId       String   @map("plan_id") @db.Uuid
  plan         Plan     @relation(fields: [planId], references: [id])
  status       String   @db.VarChar(50)
  billingCycle String   @map("billing_cycle") @db.VarChar(20)
  amount       Decimal  @db.Decimal(10, 2)
  startedAt    DateTime @map("started_at") @db.Timestamptz
  endsAt       DateTime? @map("ends_at") @db.Timestamptz
  cancelledAt  DateTime? @map("cancelled_at") @db.Timestamptz
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@map("subscriptions")
}
```

### أول Migration
```bash
pnpm prisma migrate dev --name init_master_schema
```

### packages/database/src/seeds/master.seed.ts
```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding plans...')

  await prisma.plan.upsert({
    where: { slug: 'starter' },
    update: {},
    create: {
      name: 'Starter',
      slug: 'starter',
      priceMonthly: 199,
      priceYearly: 1990,
      features: {
        max_branches: 1,
        max_users: 3,
        installments: false,
        multi_currency: false,
        suppliers: false,
        expenses: false,
        advanced_reports: false,
        offline_mode: false,
        api_access: false,
      },
    },
  })

  await prisma.plan.upsert({
    where: { slug: 'professional' },
    update: {},
    create: {
      name: 'Professional',
      slug: 'professional',
      priceMonthly: 499,
      priceYearly: 4990,
      features: {
        max_branches: 5,
        max_users: 15,
        installments: true,
        multi_currency: true,
        suppliers: true,
        expenses: true,
        advanced_reports: true,
        offline_mode: false,
        api_access: false,
      },
    },
  })

  await prisma.plan.upsert({
    where: { slug: 'enterprise' },
    update: {},
    create: {
      name: 'Enterprise',
      slug: 'enterprise',
      priceMonthly: 999,
      priceYearly: 9990,
      features: {
        max_branches: -1,
        max_users: -1,
        installments: true,
        multi_currency: true,
        suppliers: true,
        expenses: true,
        advanced_reports: true,
        offline_mode: true,
        api_access: true,
      },
    },
  })

  console.log('✅ Plans seeded successfully')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

### تشغيل الـ Seed
```bash
pnpm db:seed
```

### Git Commit
```bash
git add .
git commit -m "feat: master db schema — plans, tenants, subscriptions + seed data"
```

### Checklist
- [ ] Prisma setup في packages/database
- [ ] Migration اشتغلت بدون errors
- [ ] الـ 3 plans اتحطوا في الـ DB
- [ ] `prisma studio` بتشوف الجداول

---

## Step 03 — Tenant Provisioning

### apps/api/src/config/database.ts
```typescript
import { PrismaClient } from '@prisma/client'
import { config } from './env'

// Master DB Client — للـ tenants والـ plans
export const masterDb = new PrismaClient({
  datasources: { db: { url: config.DATABASE_MASTER_URL } },
})

// Cache للـ tenant clients عشان مننشئش connection جديد كل مرة
const tenantClients = new Map<string, PrismaClient>()

export function getTenantDb(schemaName: string): PrismaClient {
  if (tenantClients.has(schemaName)) {
    return tenantClients.get(schemaName)!
  }

  // بنعمل connection جديد على الـ schema بتاع الـ tenant
  const url = config.DATABASE_MASTER_URL + `?schema=${schemaName}`
  const client = new PrismaClient({
    datasources: { db: { url } },
  })

  tenantClients.set(schemaName, client)
  return client
}
```

### apps/api/src/modules/tenants/tenant.service.ts
```typescript
import { masterDb, getTenantDb } from '@/config/database'

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
      reports: ['read', 'export'],
      settings: ['read', 'update'],
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
      reports: ['read', 'export'],
      settings: ['read'],
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
      reports: [],
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
    },
  },
]

export async function provisionTenant(data: {
  name: string
  subdomain: string
  planId: string
  ownerName: string
  ownerEmail: string
  ownerPassword: string
}) {
  const schemaName = `tenant_${data.subdomain.replace(/-/g, '_')}`

  // 1. إنشاء الـ tenant في Master DB
  const tenant = await masterDb.tenant.create({
    data: {
      name: data.name,
      subdomain: data.subdomain,
      schemaName,
      planId: data.planId,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 يوم trial
    },
    include: { plan: true },
  })

  // 2. إنشاء PostgreSQL Schema
  await masterDb.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

  // 3. الـ Tenant DB Client
  const db = getTenantDb(schemaName)

  // 4. إنشاء أول فرع
  const branch = await db.branch.create({
    data: { name: data.name, isActive: true },
  })

  // 5. إنشاء الأدوار الافتراضية
  const roles = await Promise.all(
    DEFAULT_ROLES.map(role => db.role.create({ data: role }))
  )

  const superAdminRole = roles.find(r => r.slug === 'super_admin')!

  // 6. إنشاء الـ Super Admin user
  const { hashPassword } = await import('@/shared/utils/password')
  const passwordHash = await hashPassword(data.ownerPassword)

  await db.user.create({
    data: {
      fullName: data.ownerName,
      email: data.ownerEmail,
      passwordHash,
      branchId: branch.id,
      roleId: superAdminRole.id,
      isActive: true,
    },
  })

  // 7. إنشاء الإعدادات الافتراضية
  await db.tenantSettings.create({
    data: {
      currencyDefault: 'EGP',
      vatEnabled: false,
      language: 'ar',
      timezone: 'Africa/Cairo',
    },
  })

  console.log(`✅ Tenant provisioned: ${data.subdomain}`)
  return tenant
}
```

### apps/api/src/shared/utils/password.ts  ← v1.2: bcrypt, not SHA-256
```typescript
// SHA-256 is unsuitable for passwords (a GPU computes billions of hashes per second).
// bcrypt is slow by design and includes a per-hash salt automatically.
// Cost factor 12 ≈ 250ms on modern CPU.
import bcrypt from 'bcryptjs'

const COST = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST)
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  return bcrypt.compare(password, stored)
}
```

### apps/api/src/modules/tenants/tenant.routes.ts
```typescript
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { provisionTenant } from './tenant.service'
import { masterDb } from '@/config/database'

const registerSchema = z.object({
  name: z.string().min(2).max(200),
  subdomain: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  planSlug: z.string(),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
})

export async function tenantRoutes(app: FastifyInstance) {
  // تسجيل عميل جديد
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)

    // التأكد إن الـ subdomain مش موجود
    const existing = await masterDb.tenant.findUnique({
      where: { subdomain: body.subdomain },
    })
    if (existing) {
      return reply.status(409).send({ error: 'subdomain_taken' })
    }

    // جيب الـ plan
    const plan = await masterDb.plan.findFirst({
      where: { slug: body.planSlug, isActive: true },
    })
    if (!plan) {
      return reply.status(404).send({ error: 'plan_not_found' })
    }

    const tenant = await provisionTenant({
      name: body.name,
      subdomain: body.subdomain,
      planId: plan.id,
      ownerName: body.ownerName,
      ownerEmail: body.ownerEmail,
      ownerPassword: body.ownerPassword,
    })

    return reply.status(201).send({
      message: 'Tenant created successfully',
      subdomain: tenant.subdomain,
      loginUrl: `https://${tenant.subdomain}.storify.com`,
    })
  })
}
```

### Git Commit
```bash
git add .
git commit -m "feat: tenant provisioning — auto schema creation + default roles + seed"
```

### Checklist
- [ ] `POST /register` بيعمل tenant جديد
- [ ] PostgreSQL schema بيتعمل تلقائياً
- [ ] الأدوار الخمسة بيتحطوا تلقائياً
- [ ] Super Admin user بيتعمل تلقائياً

---

## Step 04 — Auth System

### apps/api/src/modules/auth/auth.service.ts
```typescript
import { FastifyInstance } from 'fastify'
import { getTenantDb } from '@/config/database'
import { verifyPassword } from '@/shared/utils/password'

export async function loginUser(
  app: FastifyInstance,
  schemaName: string,
  email: string,
  password: string
) {
  const db = getTenantDb(schemaName)

  const user = await db.user.findUnique({
    where: { email },
    include: { role: true, branch: true },
  })

  if (!user || !user.isActive) {
    throw new Error('invalid_credentials')
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw new Error('invalid_credentials')

  // Update last login
  await db.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  })

  const payload = {
    userId: user.id,
    email: user.email,
    roleSlug: user.role.slug,
    permissions: user.role.permissions,
    branchId: user.branchId,
  }

  const accessToken = app.jwt.sign(payload, {
    expiresIn: '15m',
  })

  const refreshToken = app.jwt.sign(
    { userId: user.id, type: 'refresh' },
    { expiresIn: '7d' }
  )

  return { accessToken, refreshToken, user: payload }
}
```

### apps/api/src/shared/middleware/tenant.middleware.ts
```typescript
import { FastifyRequest, FastifyReply } from 'fastify'
import { masterDb, getTenantDb } from '@/config/database'

export async function tenantMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const hostname = request.hostname
  const subdomain = hostname.split('.')[0]

  // تجاهل الـ admin panel
  if (subdomain === 'admin' || subdomain === 'www') return

  const tenant = await masterDb.tenant.findUnique({
    where: { subdomain },
    include: { plan: true },
  })

  if (!tenant || !tenant.isActive) {
    return reply.status(404).send({ error: 'tenant_not_found' })
  }

  // تحقق من انتهاء الاشتراك (بعد الـ trial)
  if (tenant.trialEndsAt && tenant.trialEndsAt < new Date()) {
    const activeSub = await masterDb.subscription.findFirst({
      where: { tenantId: tenant.id, status: 'active' },
    })
    if (!activeSub) {
      return reply.status(402).send({ error: 'subscription_required' })
    }
  }

  // حط الـ tenant info والـ db client في الـ request
  ;(request as any).tenant = tenant
  ;(request as any).tenantDb = getTenantDb(tenant.schemaName)
}
```

### apps/api/src/shared/middleware/auth.middleware.ts
```typescript
import { FastifyRequest, FastifyReply } from 'fastify'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'unauthorized' })
  }
}

export function requirePermission(resource: string, action: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any
    const permissions = user.permissions as Record<string, string[]>

    if (!permissions[resource]?.includes(action)) {
      return reply.status(403).send({ error: 'forbidden' })
    }
  }
}

export function requireFeature(feature: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const tenant = (request as any).tenant
    const features = tenant.plan.features as Record<string, any>

    if (!features[feature]) {
      return reply.status(403).send({
        error: 'upgrade_required',
        feature,
      })
    }
  }
}
```

### Git Commit
```bash
git add .
git commit -m "feat: auth system — JWT login, tenant middleware, permission guards"
```

### Checklist
- [ ] `POST /auth/login` بيرجع access + refresh tokens
- [ ] Tenant Middleware شغال على كل request
- [ ] Permission Guard شغال
- [ ] Feature Guard شغال

---

## Step 05 — Tenant Schema & Core Tables

> في الـ step ده هنعمل Prisma schema للـ tenant tables وهنشغّل migration عليهم.
> ملاحظة: Prisma بيدعم multi-schema — هنعمل schema منفصل للـ tenant tables.

### إضافة للـ prisma/schema.prisma
بعد ما نكمل الـ Master schema، هنضيف ملف `schema.tenant.prisma` منفصل للـ tenant tables اللي عرّفناهم في القسم 4.

### الـ Seed الافتراضي لكل tenant جديد
```typescript
// بيتشغّل تلقائياً في provisionTenant
const defaults = [
  // Tax Rates
  { name: 'بدون ضريبة', rate: 0, isDefault: true },
  { name: 'VAT 14%', rate: 14, isDefault: false },

  // Expense Categories
  { name: 'إيجار', color: '#E74C3C' },
  { name: 'كهرباء وميه', color: '#F39C12' },
  { name: 'رواتب', color: '#3498DB' },
  { name: 'صيانة', color: '#2ECC71' },
  { name: 'تسويق', color: '#9B59B6' },
  { name: 'مصروفات متنوعة', color: '#95A5A6' },

  // Default Currency
  { code: 'EGP', name: 'جنيه مصري', rateToBase: 1, isBase: true },
]
```

### Git Commit
```bash
git add .
git commit -m "feat: tenant schema — all core tables with migrations and default seed"
```

---

## Step 06 — Core APIs

> الـ APIs الأساسية للمرحلة الأولى — كل module في folder منفصل.

### Module Structure (لكل module)
```
apps/api/src/modules/products/
  ├── product.routes.ts      ← الـ route definitions + validation schemas
  ├── product.service.ts     ← الـ business logic
  └── product.types.ts       ← TypeScript types خاصة بالـ module
```

### الـ Modules المطلوبة في المرحلة الأولى

| Module | الـ Routes الأساسية |
|---|---|
| products | GET /products, POST, PUT /:id, DELETE /:id, GET /barcode/:code |
| stock | GET /stock, PUT /stock/:productId, POST /stock/movement |
| customers | GET /customers, POST, PUT /:id, POST /:id/documents |
| invoices | POST /invoices, GET /invoices, GET /invoices/:id |
| installments | POST /installments, GET /installments, PUT /:id/approve, POST /:id/payment |
| reports | GET /reports/dashboard, GET /reports/sales, GET /reports/stock |

---

## Step 07 — Frontend Foundation

### إنشاء React App
```bash
cd apps/web
pnpm create vite . --template react-ts
pnpm add react-router-dom @tanstack/react-query axios zustand
pnpm add -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### الـ Folder Structure
```
apps/web/src/
├── api/           ← axios instances + API calls
├── components/    ← reusable components
│   ├── ui/        ← Button, Input, Modal, Table...
│   └── layout/    ← Sidebar, Header, PageWrapper
├── pages/         ← كل page في folder
│   ├── auth/
│   ├── dashboard/
│   ├── products/
│   ├── pos/       ← شاشة البيع
│   └── installments/
├── stores/        ← Zustand stores
├── hooks/         ← custom hooks
└── types/         ← TypeScript types
```

### Git Commit
```bash
git add .
git commit -m "feat: frontend foundation — react, router, query, tailwind setup"
```

---

# ملاحظات مهمة للتنفيذ

## قواعد الكود
1. **كل حاجة بـ TypeScript strict** — مفيش `any` إلا في حالات استثنائية موثقة
2. **Zod لكل input** — validate كل request body وquery params
3. **NUMERIC(15,4) لكل الأرقام المالية** — مفيش float أبداً
4. **كل query على الـ tenant db** تمر بالـ tenant middleware
5. **كل feature متقدمة** تمر بالـ requireFeature guard

## Security Rules
1. Refresh token في HttpOnly Cookie — مش في localStorage
2. Rate limiting على كل الـ routes
3. Helmet للـ security headers
4. CORS مقيد على الـ tenant subdomain بس

## Naming Conventions
- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/Variables: `camelCase`
- Database tables: `snake_case`
- Environment variables: `UPPER_SNAKE_CASE`

---

*آخر تحديث: 2026-04-28 | الإصدار: 1.0.0*
