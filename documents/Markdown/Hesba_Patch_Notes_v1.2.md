# حِسبة — Documentation Patch Notes v1.2
> Pre-implementation patches applied to the spec before any code is written
> **Date:** 2026-05-10
> **Reason:** Resolve cross-document inconsistencies + close critical gaps surfaced during deep review

---

## Why this patch exists

The v1.0/v1.1 docs were authored across multiple files with drift. Before Step 01 starts, the spec must be self-consistent and feature-complete enough that the schema doesn't need invasive retrofits later (variants, audit logs, password reset).

Every change below has been applied in-place to the affected docs. This file is the index of what changed and why.

---

## A. Inconsistencies Resolved

### A1. Tenant identifier field naming
**Decision:** `subdomain` + `schema_name` (matches `HESBA_MASTER_DOCUMENT.md` and `.trae/phase1-mvp.md`).

| Old (in `HESBA_COMPLETE_CONTEXT.md`) | New (canonical) |
|---|---|
| `tenants.slug` | `tenants.subdomain` |
| `tenants.db_name` | `tenants.schema_name` |
| `tenants.db_url` | (removed — connection string is derived) |

**Files updated:** `HESBA_COMPLETE_CONTEXT.md` (Sections 4, 5).

### A2. `invoices.payment_type` deprecated
**Decision:** Use `invoices.payment_method_id UUID FK→payment_methods` (v1.1 model).

The string field `payment_type VARCHAR(50)` in the v1.0 master doc has been replaced. There is no migration path because no code exists yet.

**Files updated:** `HESBA_MASTER_DOCUMENT.md` (Section 4 invoices table).

### A3. Starter plan `max_users`
**Decision:** `3` (matches business doc, master doc, and the `Hesba_Business_Document.md` plans table).

The `2` in `HESBA_COMPLETE_CONTEXT.md` Section 15 was a typo.

**Files updated:** `HESBA_COMPLETE_CONTEXT.md` (Section 15 seed data).

---

## B. Critical Fixes Applied

### B1. Password hashing: SHA-256 → bcrypt
**Reason:** SHA-256 is a fast hash unsuitable for passwords (a GPU computes billions/sec). bcrypt is the industry standard — slow by design and includes salt automatically.

**Dependency added:** `bcryptjs ^2.4.3` (pure-JS, no native compile required for Railway/Vercel).

**Code replacement:**
```typescript
// apps/api/src/shared/utils/password.ts
import bcrypt from 'bcryptjs';

const COST = 12; // bcrypt rounds — ~250ms on modern CPU

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  return bcrypt.compare(password, stored);
}
```

`users.password_hash` field stays `TEXT` (bcrypt hashes are 60 chars).

**Files updated:** `HESBA_COMPLETE_CONTEXT.md` (Section 6), `HESBA_MASTER_DOCUMENT.md` (Step 03 password.ts + Step 01 package.json deps).

### B2. `decimal.js` dependency added
**Reason:** All financial calculation snippets reference `decimal.js` but it was missing from `apps/api/package.json`.

**Dependency added:** `decimal.js ^10.4.3`.

**Files updated:** `HESBA_MASTER_DOCUMENT.md` (Step 01 package.json).

### B3. Stock check moved inside transaction
**Reason:** The original invoice flow validated stock BEFORE the transaction. Two cashiers selling the last unit simultaneously both pass validation, both transactions succeed, stock goes negative.

**New rule:** Stock check happens inside the transaction with row-level locking via Prisma's atomic conditional update.

```typescript
// Inside db.$transaction(async (tx) => { ... })
for (const item of data.items) {
  // Atomic: only succeeds if quantity >= item.quantity
  const updated = await tx.stock.updateMany({
    where: {
      productVariantId: item.variantId,
      branchId: data.branchId,
      quantity: { gte: item.quantity },
    },
    data: { quantity: { decrement: item.quantity } },
  });
  if (updated.count === 0) {
    throw new Error(`insufficient_stock:${item.variantId}`);
  }
  // movement log...
}
```

**Files updated:** `HESBA_COMPLETE_CONTEXT.md` (Section 10).

### B4. Connection pool eviction for tenant clients
**Reason:** `getTenantDb()` cached PrismaClients in a `Map` forever. With 100 tenants × 10 connections each = 1000 connections; PostgreSQL default `max_connections = 100`.

**New rule:** LRU cache with TTL eviction.
```typescript
import { LRUCache } from 'lru-cache';

const tenantClients = new LRUCache<string, PrismaClient>({
  max: 50,                      // most-recently-used 50 schemas
  ttl: 1000 * 60 * 30,          // 30 min idle TTL
  dispose: (client) => { client.$disconnect(); }, // close pool on eviction
});
```

**Dependency added:** `lru-cache ^10.2.0`.

**Files updated:** `HESBA_COMPLETE_CONTEXT.md` (Section 5), `HESBA_MASTER_DOCUMENT.md` (Step 03 + package.json).

### B5. Tenant schema versioning + migration runner
**Reason:** When you add a column to the tenant schema in month 6, you have N tenants whose schemas are stale. The original docs said "run migrations" without specifying how.

**New field:** `tenants.schema_version INTEGER NOT NULL DEFAULT 0`.

**New runner:** `packages/database/src/migrate-tenants.ts` walks all tenants, applies migrations newer than their `schema_version`, updates `schema_version` on success. Failures are logged per-tenant; the runner doesn't abort the batch.

Migration files live in `packages/database/migrations/tenant/` numbered `001_init.sql`, `002_add_variants.sql`, etc. Each is a plain SQL file run via `client.$executeRawUnsafe()` against the tenant schema.

**Files updated:** `HESBA_COMPLETE_CONTEXT.md` (Section 5).

---

## C. New Tables Added to Tenant Schema

### C1. `product_variants` — CRITICAL
**Reason:** Target market is "clothing, electronics, shoes." A T-shirt has 5 sizes × 4 colors = 20 SKUs. The original `products` table had a single SKU/price/barcode — unusable for the stated market.

```sql
CREATE TABLE product_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku             VARCHAR(100),
  barcode         VARCHAR(100),
  attributes      JSONB NOT NULL DEFAULT '{}',  -- {"size":"L","color":"red"}
  cost_price      DECIMAL(15,4),                 -- NULL = inherit from product
  sell_price      DECIMAL(15,4),                 -- NULL = inherit from product
  image_url       TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, sku)
);
CREATE INDEX idx_variants_barcode ON product_variants(barcode) WHERE barcode IS NOT NULL;
```

**Schema impact (all FKs change):**
- `stock.product_id` → `stock.variant_id` (FK→`product_variants`)
- `invoice_items.product_id` → `invoice_items.variant_id`
- `stock_movements.product_id` → `stock_movements.variant_id`
- `stock_transfer_items.product_id` → `stock_transfer_items.variant_id`
- `purchase_order_items.product_id` → `purchase_order_items.variant_id`
- `return_items.product_id` → `return_items.variant_id`
- `product_discounts.product_id` stays (discount applies to all variants of a product)

**Single-variant products:** When a product has no real variants, the system auto-creates a default variant with `attributes = {}` so callers always work with `variant_id`.

### C2. `audit_logs` — required for financial compliance
```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id),    -- NULL for system actions
  entity      VARCHAR(100) NOT NULL,         -- "invoice", "user", "permission"
  entity_id   UUID,
  action      VARCHAR(50) NOT NULL,          -- "create", "update", "delete", "approve", "login"
  before      JSONB,                         -- prior state (NULL on create)
  after       JSONB,                         -- new state (NULL on delete)
  ip          INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
```

**Mandatory audit events (Phase 1):**
- All login attempts (success + failure)
- Invoice create / refund
- Installment approve / reject
- Permission changes
- User create / deactivate
- Price changes (products + variants)
- Manual stock adjustments

### C3. `password_reset_tokens` — closes auth gap
```sql
CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,           -- SHA-256 of the raw token (raw token sent in email only)
  expires_at  TIMESTAMPTZ NOT NULL,           -- 1 hour from creation
  used_at     TIMESTAMPTZ,                    -- NULL until consumed
  ip          INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reset_user ON password_reset_tokens(user_id);
```

**Flow:**
1. `POST /api/auth/forgot-password` { email } → always returns 200 (prevent enumeration)
2. If email exists, generate 32-byte token, store SHA-256 hash, email raw token
3. `POST /api/auth/reset-password` { token, newPassword } → verify hash, check expires_at + used_at, update password, mark used_at

**Rate limit:** 5 requests per email per hour.

---

## D. Strategic Deferrals (documented, not implemented in Phase 1)

These were identified during gap analysis but explicitly deferred. They appear here so they aren't "discovered" mid-build.

### D1. Egyptian e-invoicing (ETA) — ✅ NOW IN PHASE 1 SCOPE (Option C)
**Status:** Confirmed for Phase 1 — full integration.
**Schema additions:** see `tenant_settings` (ETA config block), `invoices` (ETA tracking fields), and new `eta_submissions` table — documented in `HESBA_COMPLETE_CONTEXT.md` Section 4.
**Implementation step:** new Step 09a — ETA Integration (~3 weeks).
**Timeline impact:** Phase 1 extends from 3 months to ~4 months.
**Required externally before coding starts:**
- ETA portal account (preprod first, then production)
- Activity classification code from ETA registration
- Digital signing certificate (USB token or cloud HSM)
- Each customer (tenant) provides their own `eta_taxpayer_id`

### D2. Cashier shifts (cash drawer reconciliation)
**Status:** Phase 2.
**Schema sketch:**
```sql
cashier_shifts (id, cashier_id, branch_id, opened_at, closed_at,
                opening_cash, closing_cash_expected, closing_cash_actual,
                variance, status)
```
Phase 1 invoices will not be linked to a shift. Adding `invoices.shift_id` later is non-breaking (nullable).

### D3. Loyalty / gift cards / quotes / serial numbers
**Status:** Phase 2 backlog. No schema changes in Phase 1.

### D4. SaaS billing — ✅ NOW IN PHASE 1 SCOPE (Paymob)
**Status:** Confirmed — Paymob integration in Phase 1.
**Master DB additions:** `subscriptions.provider/provider_subscription_id/provider_customer_id/last_payment_at/next_billing_at/failed_attempts`, new `payment_attempts` table — documented in `HESBA_COMPLETE_CONTEXT.md` Section 4.
**Implementation step:** new Step 09b — Paymob Integration (~1 week).
**Dunning flow:** day 0 fail → 1 attempt; day 3 retry; day 7 retry → PAST_DUE; day 14 retry → SUSPENDED; day 44 → CANCELLED + 30d data retention.
**Required externally before coding starts:**
- Paymob merchant account
- Integration ID (from Paymob dashboard)
- API key + HMAC secret for webhook verification
- Decide: cards-only or include Fawry/ValU at launch

### D5. 2FA for Super Admin
**Status:** Phase 2.
**Schema sketch:** `users.totp_secret`, `users.totp_enabled_at`, `users.backup_codes JSONB`.

### D6. Offline mode (`offline_queue` table)
**Status:** Already in schema for Phase 3 — leave the table in place but no API consumes it in Phase 1. Keep as forward-compat.

---

## E. Files Touched

| File | Type of changes |
|---|---|
| `documents/Claude_Code/HESBA_COMPLETE_CONTEXT.md` | Field renames, schema additions, code corrections |
| `documents/Claude_Code/HESBA_MASTER_DOCUMENT.md` | package.json deps, password.ts, invoices schema |
| `documents/Markdown/Hesba_ERD_Document.md` | New v1.2 section with new tables |
| `documents/Markdown/Hesba_Patch_Notes_v1.2.md` | This file (new) |

`Hesba_Logic_Flow_Document.md`, `Hesba_Technical_Architecture.md`, `Hesba_Business_Document.md`, `Hesba_Design_System.md`, `Hesba_Payment_Fees_Update.md` — left untouched. They reference business outcomes, not specific field names, so the patches above don't invalidate them.

---

## F. Pre-Step-01 Checklist

Before starting Step 01:
- [x] Field naming standardized (subdomain / schema_name)
- [x] Password hashing fixed (bcrypt)
- [x] decimal.js + lru-cache + bcryptjs added to deps
- [x] Stock locking strategy defined
- [x] Tenant migration runner strategy defined
- [x] product_variants table added to spec
- [x] audit_logs table added to spec
- [x] password_reset_tokens table added to spec
- [x] D1 ETA full integration confirmed for Phase 1 (Option C)
- [x] D2/D4 Paymob confirmed as billing provider
- [ ] Customer must obtain ETA preprod account before Step 09a
- [ ] Customer must obtain Paymob credentials before Step 09b

---

*Patch v1.2 — applied 2026-05-10*
