# حِسبة — Technical Architecture Document
> وثيقة القرارات التقنية والمعمارية
> **الإصدار:** 1.0.0 | **التاريخ:** أبريل 2026

---

## الفهرس
1. System Architecture Overview
2. Architecture Decision Records (ADRs)
3. Frontend Architecture
4. Backend Architecture
5. Database Architecture
6. Multi-tenant Architecture
7. Security Architecture
8. Infrastructure & Deployment
9. API Design Patterns
10. Error Handling & Logging
11. Performance Considerations
12. Testing Strategy

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Cloudflare DNS                     │
│           *.hesbaapp.com → Railway API               │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│              Vercel (React SPA)                     │
│  React + Vite + TailwindCSS + TanStack Query        │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────┐
│           Railway — Fastify API Server              │
│  [Tenant MW] [Auth MW] [Feature Guard MW]           │
│  [Route Modules: products|invoices|stock|...]       │
│  [BullMQ] [Zod Schemas] [Prisma ORM]               │
└──────┬─────────────────┬────────────────────┬───────┘
       │                 │                    │
┌──────▼──────┐ ┌────────▼───────┐ ┌─────────▼──────┐
│ PostgreSQL  │ │ Redis (Upstash)│ │ Cloudflare R2  │
│ master      │ │ Sessions       │ │ Images/PDFs    │
│ tenant_abc  │ │ BullMQ Jobs    │ │ Documents      │
│ tenant_xyz  │ │ Rate Limiting  │ │ Signatures     │
└─────────────┘ └────────────────┘ └────────────────┘
```

### الطبقات الرئيسية
| الطبقة | التقنية | المسؤولية |
|---|---|---|
| Presentation | React + Vite + TailwindCSS | واجهة المستخدم — SPA |
| API Gateway | Fastify + TypeScript | استقبال الطلبات، التوثيق، التوجيه |
| Middleware Layer | Tenant + Auth + Feature Guards | عزل المستأجرين، الصلاحيات |
| Business Logic | Route Handlers + Services | منطق الأعمال، الحسابات |
| Data Access | Prisma ORM | التعامل مع قاعدة البيانات |
| Infrastructure | PostgreSQL + Redis + R2 | التخزين والـ Cache |

---

## 2. Architecture Decision Records (ADRs)

### ADR-001: Fastify بدلاً من Express أو NestJS ✅ Accepted
**السياق:** المشروع محتاج backend يدعم multi-tenant مع طلبات متوازية وWebSockets.

**القرار:** Fastify + TypeScript

**المبرر:**
- أسرع من Express بـ 2x في الـ benchmarks
- TypeScript first بشكل native
- Plugin system منظم لـ middleware stack نظيف
- دعم WebSockets للأوف لاين sync

**البدائل المرفوضة:**
- NestJS: overhead كبير وصعب مع فريق صغير
- Express: أبسط لكن أبطأ ومفيش TypeScript native

---

### ADR-002: PostgreSQL Schemas للـ Multi-tenant Isolation ✅ Accepted
**القرار:** كل tenant على PostgreSQL Schema منفصل (tenant_{id})

**المبرر:**
- عزل كامل للبيانات مع نفس connection pool
- أرخص من database منفصلة لكل عميل
- Prisma يدعم multi-schema بشكل ممتاز
- Backup مستقل لكل عميل

**البدائل المرفوضة:**
- Database منفصلة: تكلفة Infrastructure عالية جداً
- Shared tables مع tenant_id: خطر تسرب البيانات

---

### ADR-003: Prisma كـ ORM ✅ Accepted
**القرار:** Prisma ORM للتعامل مع PostgreSQL

**المبرر:**
- Type-safe queries تمنع runtime errors في الحسابات المالية
- Schema file يوثّق كل قاعدة البيانات
- Migrations مدارة تلقائياً
- Prisma Studio للـ debugging

---

### ADR-004: pnpm Workspaces Monorepo ✅ Accepted
**القرار:** packages: @hesba/api, @hesba/web, @hesba/database, @hesba/shared

**المبرر:**
- مشاركة TypeScript types بين Frontend وBackend
- Atomic commits تشمل تغييرات في أكثر من package
- pnpm أسرع من npm وأقل disk usage

---

### ADR-005: JWT مع Refresh Token في HttpOnly Cookie ✅ Accepted
**القرار:** Access Token (15 دقيقة) في Authorization header + Refresh Token (7 أيام) في HttpOnly Cookie

**المبرر:**
- HttpOnly Cookie تمنع XSS من سرقة الـ refresh token
- Access Token قصير يحد من الضرر لو سُرق
- الـ permissions محمولة في JWT — لا DB query في كل request

---

### ADR-006: Zod للـ Runtime Validation ✅ Accepted
**القرار:** Zod لـ validation كل request body وquery params وenv variables

**المبرر:**
- Types وZod schemas يُشاركان بين Frontend وBackend
- Parse don't validate — الـ output typed تلقائياً
- Validation errors واضحة للـ client

---

### ADR-007: BullMQ للـ Background Jobs ✅ Accepted
**القرار:** BullMQ على Redis لإدارة background jobs

**المبرر:**
- PDF، Excel، SMS تعمل في background بدون blocking
- Jobs تُحفظ في Redis ولا تضيع لو الـ server restart
- Dashboard لمتابعة الـ jobs (Bull Board)

---

## 3. Frontend Architecture

### Folder Structure
```
apps/web/src/
├── api/              ← axios clients + API calls
├── components/
│   ├── ui/           ← Button, Input, Modal, Table...
│   ├── layout/       ← Sidebar, Topbar, PageWrapper
│   └── features/     ← InvoiceCard, ProductGrid, CartItem
├── pages/            ← كل page في folder
│   ├── auth/         ← Login, Register
│   ├── dashboard/
│   ├── pos/          ← شاشة البيع
│   ├── invoices/
│   ├── installments/
│   ├── products/
│   ├── stock/
│   ├── customers/
│   ├── suppliers/
│   ├── expenses/
│   ├── reports/
│   └── settings/
├── stores/           ← Zustand
│   ├── auth.store.ts
│   ├── cart.store.ts
│   └── ui.store.ts
├── hooks/
│   ├── usePermission.ts
│   ├── useTenant.ts
│   └── useBarcode.ts
└── types/
```

### State Management
| نوع الـ State | الأداة | الاستخدام |
|---|---|---|
| Server State | TanStack Query | Data من الـ API — caching + invalidation |
| Global Client State | Zustand | auth user، cart، UI state |
| Form State | React Hook Form + Zod | validation + submission |
| URL State | React Router v6 | pagination، filters |

### API Client Pattern
```typescript
// Request interceptor: Access Token
apiClient.interceptors.request.use((config) => {
  const token = authStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: Refresh Token تلقائي
apiClient.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 401) {
    const newToken = await refreshAccessToken();
    error.config.headers.Authorization = `Bearer ${newToken}`;
    return apiClient(error.config);
  }
  return Promise.reject(error);
});
```

---

## 4. Backend Architecture

### Folder Structure
```
apps/api/src/
├── config/
│   ├── env.ts          ← Zod env validation
│   ├── database.ts     ← Master DB + getTenantDb()
│   └── redis.ts
├── modules/
│   ├── auth/
│   ├── tenants/        ← provisionTenant()
│   ├── invoices/
│   ├── products/
│   ├── stock/
│   ├── installments/
│   ├── customers/
│   ├── suppliers/
│   ├── expenses/
│   └── reports/
├── shared/
│   ├── middleware/
│   │   ├── tenant.middleware.ts
│   │   ├── auth.middleware.ts
│   │   └── feature.middleware.ts
│   ├── plugins/
│   └── utils/
│       ├── fee.ts       ← calculateFee()
│       └── decimal.ts   ← financial calculations
└── jobs/
    ├── pdf.job.ts
    ├── excel.job.ts
    └── sms.job.ts
```

### Module Pattern
```typescript
// كل route يمر بـ middleware stack
app.post('/invoices', {
  preHandler: [
    authenticate,                        // 1. JWT check
    tenantMiddleware,                     // 2. tenant isolation
    requirePermission('invoices', 'create'), // 3. permission check
  ]
}, createInvoiceHandler);

// createInvoice يعمل كـ transaction
return db.$transaction(async (tx) => {
  const invoice = await tx.invoice.create({ data });
  // تحديث المخزون + fee expense في نفس الـ transaction
});
```

---

## 5. Database Architecture

### Schema Strategy
```sql
-- Master DB: plans, tenants, subscriptions
-- tenant_ahmed_store.*   ← كل جداول التطبيق
-- tenant_cairo_mall.*    ← بيانات منفصلة تماماً
-- tenant_alex_fashion.*
```

### Dynamic Prisma Client
```typescript
const tenantClients = new Map<string, PrismaClient>();

export function getTenantDb(schemaName: string): PrismaClient {
  if (tenantClients.has(schemaName)) return tenantClients.get(schemaName)!;
  
  const url = `${config.DATABASE_MASTER_URL}?schema=${schemaName}`;
  const client = new PrismaClient({ datasources: { db: { url } } });
  tenantClients.set(schemaName, client);
  return client;
}
```

### Financial Data Rules
| القاعدة | السبب |
|---|---|
| DECIMAL(15,4) دائماً | تجنب floating point errors |
| حفظ القيم وقت الحدث | الفاتورة القديمة لا تتأثر بتغيير الأسعار |
| decimal.js للحسابات | دقة حسابية في JavaScript |
| TIMESTAMPTZ دائماً | تجنب مشاكل المنطقة الزمنية |

---

## 6. Multi-tenant Architecture

### Tenant Middleware
```typescript
export async function tenantMiddleware(request, reply) {
  const subdomain = request.hostname.split('.')[0];
  
  // Cache في Redis لـ 5 دقائق
  let tenant = await redis.get(`tenant:${subdomain}`);
  if (!tenant) {
    tenant = await masterDb.tenant.findUnique({ where: { slug: subdomain }, include: { plan: true } });
    if (tenant) await redis.setex(`tenant:${subdomain}`, 300, JSON.stringify(tenant));
  }

  if (!tenant?.isActive) return reply.status(404).send({ error: 'tenant_not_found' });
  if (isSubscriptionExpired(tenant)) return reply.status(402).send({ error: 'subscription_expired' });

  request.tenant = tenant;
  request.tenantDb = getTenantDb(tenant.schemaName);
}
```

### Feature Guard
```typescript
export function requireFeature(feature: keyof PlanFeatures) {
  return async (request, reply) => {
    if (!request.tenant.plan.features[feature]) {
      return reply.status(403).send({ error: 'upgrade_required', feature });
    }
  };
}

// Usage:
app.post('/installments',
  { preHandler: [authenticate, tenantMiddleware, requireFeature('installments')] },
  handler
);
```

### Provisioning Flow
```typescript
async function provisionTenant(data) {
  const schemaName = `tenant_${data.slug.replace(/-/g, '_')}`;
  
  await masterDb.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { ...data, schemaName } });
    await masterDb.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await runTenantMigrations(schemaName);
    
    const db = getTenantDb(schemaName);
    await db.$transaction([
      db.role.createMany({ data: DEFAULT_ROLES }),
      db.branch.create({ data: { name: data.name } }),
      db.paymentMethod.createMany({ data: DEFAULT_PAYMENT_METHODS }),
      // ... rest of seed data
    ]);
  });
}
```

---

## 7. Security Architecture

| الطبقة | الآلية | ضد ماذا؟ |
|---|---|---|
| Transport | HTTPS / TLS 1.3 | Man-in-the-middle |
| Authentication | JWT + HttpOnly Cookie | Session hijacking, XSS |
| Authorization | RBAC + Permission Guards | Privilege escalation |
| Tenant Isolation | PostgreSQL Schema | Data leakage |
| Input Validation | Zod schemas | SQL Injection, XSS |
| Rate Limiting | @fastify/rate-limit | Brute force, DDoS |
| Security Headers | @fastify/helmet | XSS, Clickjacking |
| CORS | محدود على الـ subdomain | Cross-origin requests |
| Password | SHA-256 + random salt | Rainbow table attacks |
| Financial | DECIMAL(15,4) + decimal.js | Floating point manipulation |

### JWT Payload
```typescript
interface JWTPayload {
  userId: string;
  tenantId: string;
  schemaName: string;
  roleSlug: string;
  branchId: string;
  permissions: Record<string, string[]>; // محمولة — لا DB query في كل request
  iat: number;
  exp: number;
}
```

---

## 8. Infrastructure & Deployment

### التكاليف
| الخدمة | المزود | التكلفة |
|---|---|---|
| API + DB | Railway Pro | ~$20/شهر |
| Frontend | Vercel Hobby | مجاني |
| Redis | Upstash | مجاني → $0.2 |
| Storage | Cloudflare R2 | مجاني لأول 10GB |
| DNS | Cloudflare | مجاني |
| Email | Resend | مجاني (3000/شهر) |
| **الإجمالي** | — | **~$20/شهر** |

### CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
jobs:
  test:
    - pnpm type-check  # TypeScript
    - pnpm lint        # ESLint
    - pnpm test        # Vitest
  
  deploy-api:    # Railway CLI
  deploy-web:    # Vercel CLI
```

---

## 9. API Design Patterns

### URL Structure
| Endpoint | Method | الوصف |
|---|---|---|
| /api/auth/login | POST | تسجيل الدخول |
| /api/products | GET | قائمة المنتجات |
| /api/products | POST | إضافة منتج |
| /api/invoices | POST | إنشاء فاتورة |
| /api/installments/:id/approve | PATCH | موافقة مدير |
| /api/reports/fees | GET | تقرير رسوم الدفع |

### Response Format
```json
// Success
{ "success": true, "data": {...}, "meta": { "total": 234, "page": 1 } }

// Error
{ "success": false, "error": { "code": "validation_error", "message": "...", "details": [...] } }
```

---

## 10. Error Handling

```typescript
app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError)
    return reply.status(400).send({ success: false, error: { code: 'validation_error', details: error.flatten() } });
  
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    return reply.status(409).send({ success: false, error: { code: 'duplicate_entry' } });
  
  app.log.error({ err: error, tenantId: request.tenant?.id });
  return reply.status(500).send({ success: false, error: { code: 'internal_error' } });
});
```

---

## 11. Performance

### Caching Strategy
```typescript
// Tenant info — 5 minutes
redis.setex(`tenant:${subdomain}`, 300, JSON.stringify(tenant));

// Dashboard stats — 2 minutes
redis.setex(`dashboard:${tenantId}:${branchId}`, 120, JSON.stringify(stats));

// Product by barcode — 30 minutes
redis.setex(`product:${tenantId}:barcode:${barcode}`, 1800, JSON.stringify(product));
```

### Database Optimizations
- Connection Pooling: Prisma يدير تلقائياً
- Tenant DB Caching: Map<schemaName, PrismaClient>
- Cursor-based Pagination للـ lists الكبيرة
- Indexes على: barcode, email, subdomain, created_at

---

## 12. Testing Strategy

| النوع | الأداة | الأولوية |
|---|---|---|
| Unit Tests | Vitest | عالية — calculateFee, Zod schemas |
| Integration Tests | Vitest + Prisma | عالية — API endpoints |
| E2E Tests | Playwright | متوسطة — POS flow |
| Load Tests | k6 | متأخرة |

### Critical Test Cases
- `calculateFee`: percentage + fixed + both + none
- **Tenant isolation**: tenant A لا يرى بيانات tenant B
- **Installment approval**: pending → active flow
- **Invoice transaction**: stock + fee expense atomically
- **JWT refresh**: تجديد تلقائي بعد 15 دقيقة
- **Feature guard**: plan downgrade يمنع الوصول
- **Decimal precision**: 0.1 + 0.2 = 0.3

---

*حِسبة Technical Architecture Document v1.0 — © 2026*
