# Storify — ERD Document
> مخطط قاعدة البيانات الكامل — Entity Relationship Diagram
> **الإصدار:** 1.0.0 | **التاريخ:** أبريل 2026

---

## Legend
- 🔑 Primary Key (PK)
- 🔗 Foreign Key (FK)
- UK = Unique Key
- 1→N = One to Many | 1→1 = One to One | N→N = Many to Many

---

## نظرة عامة

| المجموعة | عدد الجداول |
|---|---|
| Master DB | 3 جداول |
| Auth & Users | 4 جداول |
| Products & Stock | 6 جداول |
| Sales & Invoices | 6 جداول |
| Installments | 3 جداول |
| Customers | 2 جداول |
| Suppliers | 4 جداول |
| Expenses | 2 جداول |
| System | 2 جداول |
| **الإجمالي** | **30+ جدول** |

---

## المجموعة الأولى — Master Database

### plans
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | CUID | PK | معرف فريد |
| name | VARCHAR(100) | UK NOT NULL | Starter / Professional / Enterprise |
| slug | VARCHAR(50) | UK NOT NULL | starter / professional / enterprise |
| description | TEXT | NULL | وصف الباقة |
| max_products | INTEGER | DEFAULT 100 | الحد الأقصى للمنتجات |
| max_orders | INTEGER | DEFAULT 500 | الحد الأقصى للطلبات شهرياً |
| max_users | INTEGER | DEFAULT 3 | الحد الأقصى للمستخدمين |
| max_storage | INTEGER | DEFAULT 1024 | التخزين بالـ MB |
| price_monthly | DECIMAL(10,2) | NOT NULL | السعر الشهري |
| price_yearly | DECIMAL(10,2) | NOT NULL | السعر السنوي |
| features | JSONB | DEFAULT [] | مصفوفة المميزات |
| is_active | BOOLEAN | DEFAULT true | هل الباقة متاحة؟ |
| sort_order | INTEGER | DEFAULT 0 | ترتيب العرض |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | تاريخ الإنشاء |
| updated_at | TIMESTAMPTZ | AUTO UPDATE | تاريخ آخر تعديل |

### tenants
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | CUID | PK | معرف فريد |
| name | VARCHAR(200) | NOT NULL | اسم المتجر |
| slug | VARCHAR(100) | UK NOT NULL | يُستخدم في الـ subdomain |
| email | VARCHAR(255) | UK NOT NULL | البريد الرئيسي |
| phone | VARCHAR(50) | NULL | التليفون |
| logo_url | TEXT | NULL | رابط اللوجو |
| db_url | TEXT | NULL | Connection string للـ schema |
| db_name | VARCHAR(100) | NULL | اسم الـ schema |
| status | ENUM | DEFAULT ACTIVE | ACTIVE/SUSPENDED/CANCELLED/PROVISIONING |
| owner_name | VARCHAR(200) | NOT NULL | اسم المالك |
| owner_email | VARCHAR(255) | NOT NULL | بريد المالك |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | تاريخ التسجيل |
| updated_at | TIMESTAMPTZ | AUTO UPDATE | تاريخ آخر تعديل |

### subscriptions
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | CUID | PK | معرف فريد |
| 🔗 tenant_id | CUID | FK→tenants | الـ tenant |
| 🔗 plan_id | CUID | FK→plans | الباقة |
| billing_cycle | ENUM | NOT NULL | MONTHLY / YEARLY |
| status | ENUM | DEFAULT ACTIVE | ACTIVE/PAST_DUE/CANCELLED/TRIALING |
| current_period_start | TIMESTAMPTZ | NOT NULL | بداية الفترة |
| current_period_end | TIMESTAMPTZ | NOT NULL | نهاية الفترة |
| cancelled_at | TIMESTAMPTZ | NULL | تاريخ الإلغاء |
| trial_ends_at | TIMESTAMPTZ | NULL | نهاية التجربة المجانية |
| price_at_subscription | DECIMAL(10,2) | NOT NULL | السعر وقت الاشتراك |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | تاريخ الاشتراك |

---

## المجموعة الثانية — Auth & Users (Tenant Schema)

### tenant_settings
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| currency_default | VARCHAR(10) | DEFAULT EGP | العملة الافتراضية |
| vat_enabled | BOOLEAN | DEFAULT false | هل VAT مفعّل؟ |
| logo_url | TEXT | NULL | رابط اللوجو |
| print_template | TEXT | NULL | قالب الطباعة |
| language | VARCHAR(10) | DEFAULT ar | ar / en |
| timezone | VARCHAR(50) | DEFAULT Africa/Cairo | المنطقة الزمنية |

### branches
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| name | VARCHAR(200) | NOT NULL | اسم الفرع |
| address | TEXT | NULL | العنوان |
| phone | VARCHAR(50) | NULL | التليفون |
| is_active | BOOLEAN | DEFAULT true | هل الفرع مفعّل؟ |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | تاريخ الإنشاء |

### roles
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| name | VARCHAR(100) | NOT NULL | Super Admin / Branch Manager / ... |
| slug | VARCHAR(50) | UK NOT NULL | super_admin / cashier / ... |
| permissions | JSONB | DEFAULT {} | {invoices: [create, read, ...]} |
| is_system | BOOLEAN | DEFAULT false | الأدوار الافتراضية لا تُحذف |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | تاريخ الإنشاء |

### users
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 branch_id | UUID | FK→branches | الفرع |
| 🔗 role_id | UUID | FK→roles | الدور |
| full_name | VARCHAR(200) | NOT NULL | الاسم الكامل |
| email | VARCHAR(255) | UK NOT NULL | البريد (login) |
| password_hash | TEXT | NOT NULL | كلمة المرور مشفرة |
| is_active | BOOLEAN | DEFAULT true | هل الحساب مفعّل؟ |
| last_login | TIMESTAMPTZ | NULL | آخر دخول |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | تاريخ الإنشاء |

---

## المجموعة الثالثة — Products & Stock

### products
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 category_id | UUID | FK→categories | التصنيف |
| 🔗 tax_rate_id | UUID | FK→tax_rates | نسبة الضريبة |
| name | VARCHAR(300) | NOT NULL | اسم المنتج |
| barcode | VARCHAR(100) | NULL | الباركود |
| unit | VARCHAR(50) | DEFAULT piece | piece / kg / liter |
| cost_price | DECIMAL(15,4) | NOT NULL | سعر التكلفة |
| sell_price | DECIMAL(15,4) | NOT NULL | سعر البيع |
| image_url | TEXT | NULL | رابط الصورة |
| is_active | BOOLEAN | DEFAULT true | متاح للبيع؟ |

### stock
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 product_id | UUID | FK→products | المنتج |
| 🔗 branch_id | UUID | FK→branches | الفرع |
| quantity | INTEGER | DEFAULT 0 | الكمية الحالية |
| min_quantity | INTEGER | DEFAULT 0 | الحد الأدنى للتنبيه |

> ⚠️ UNIQUE(product_id, branch_id)

### stock_movements
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 product_id | UUID | FK→products | المنتج |
| 🔗 branch_id | UUID | FK→branches | الفرع |
| 🔗 user_id | UUID | FK→users | المستخدم |
| type | VARCHAR(50) | NOT NULL | in/out/transfer/adjustment/return |
| quantity | INTEGER | NOT NULL | الكمية |
| reference | TEXT | NULL | رقم الفاتورة أو PO |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | تاريخ الحركة |

---

## المجموعة الرابعة — Customers

### customers
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| full_name | VARCHAR(200) | NOT NULL | الاسم الكامل |
| phone | VARCHAR(50) | NULL | التليفون |
| national_id | VARCHAR(50) | NULL | رقم البطاقة |
| address | TEXT | NULL | العنوان |
| credit_balance | DECIMAL(15,4) | DEFAULT 0 | رصيد المرتجعات |

### customer_documents
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 customer_id | UUID | FK→customers | العميل |
| doc_type | VARCHAR(100) | NOT NULL | national_id_front/back/signature/receipt |
| file_url | TEXT | NOT NULL | رابط الملف على R2 |
| 🔗 uploaded_by | UUID | FK→users | من رفع المستند |

---

## المجموعة الخامسة — Sales & Invoices

### invoices
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 branch_id | UUID | FK→branches | الفرع |
| 🔗 customer_id | UUID | FK→customers NULL | العميل |
| 🔗 cashier_id | UUID | FK→users | الكاشير |
| 🔗 currency_id | UUID | FK→currencies | العملة |
| 🔗 coupon_id | UUID | FK→coupons NULL | الكوبون |
| payment_type | VARCHAR(50) | NOT NULL | cash/card/installment_internal/external |
| exchange_rate | DECIMAL(15,6) | DEFAULT 1 | سعر الصرف وقت البيع |
| subtotal | DECIMAL(15,4) | NOT NULL | المجموع قبل الخصم والضريبة |
| discount_amount | DECIMAL(15,4) | DEFAULT 0 | إجمالي الخصومات |
| tax_total | DECIMAL(15,4) | DEFAULT 0 | إجمالي الضرائب |
| total_amount | DECIMAL(15,4) | NOT NULL | الإجمالي النهائي |
| status | VARCHAR(50) | DEFAULT completed | completed/refunded/partial_refund |

### invoice_items
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 invoice_id | UUID | FK→invoices | الفاتورة |
| 🔗 product_id | UUID | FK→products | المنتج |
| quantity | INTEGER | NOT NULL | الكمية |
| unit_price | DECIMAL(15,4) | NOT NULL | سعر الوحدة وقت البيع |
| discount_amount | DECIMAL(15,4) | DEFAULT 0 | الخصم على البند |
| tax_amount | DECIMAL(15,4) | DEFAULT 0 | مبلغ الضريبة |
| subtotal | DECIMAL(15,4) | NOT NULL | الإجمالي للبند |

---

## المجموعة السادسة — Installments

### installment_contracts
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 invoice_id | UUID | FK→invoices | الفاتورة |
| 🔗 customer_id | UUID | FK→customers | العميل |
| 🔗 approved_by | UUID | FK→users NULL | المدير الذي وافق |
| 🔗 currency_id | UUID | FK→currencies | عملة العقد |
| exchange_rate_at_contract | DECIMAL(15,6) | DEFAULT 1 | سعر الصرف ثابت وقت العقد |
| down_payment | DECIMAL(15,4) | NOT NULL | المقدم |
| installments_count | INTEGER | NOT NULL | عدد الأقساط |
| monthly_amount | DECIMAL(15,4) | NOT NULL | قيمة القسط الشهري |
| interest_rate | DECIMAL(5,2) | DEFAULT 0 | نسبة الفائدة |
| total_amount | DECIMAL(15,4) | NOT NULL | إجمالي العقد |
| first_due_date | DATE | NOT NULL | تاريخ أول قسط |
| status | VARCHAR(50) | DEFAULT pending_approval | pending_approval/active/completed/cancelled |
| signature_url | TEXT | NULL | رابط صورة التوقيع على R2 |

### installment_payments
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 contract_id | UUID | FK→installment_contracts | العقد |
| 🔗 received_by | UUID | FK→users NULL | من استلم الدفعة |
| installment_number | INTEGER | NOT NULL | رقم القسط |
| amount_paid | DECIMAL(15,4) | NOT NULL | المبلغ المدفوع |
| due_date | DATE | NOT NULL | تاريخ الاستحقاق |
| paid_date | DATE | NULL | تاريخ الدفع الفعلي |
| receipt_url | TEXT | NULL | رابط الإيصال |
| status | VARCHAR(50) | DEFAULT pending | pending/paid/overdue |

---

## المجموعة السابعة — Suppliers

### suppliers
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| name | VARCHAR(200) | NOT NULL | اسم المورد |
| balance | DECIMAL(15,4) | DEFAULT 0 | موجب=المورد له فلوس، سالب=نحن مديونين |

### purchase_orders
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 supplier_id | UUID | FK→suppliers | المورد |
| 🔗 branch_id | UUID | FK→branches | الفرع |
| 🔗 approved_by | UUID | FK→users NULL | من وافق |
| status | VARCHAR(50) | DEFAULT draft | draft/pending/approved/received/cancelled |
| total_amount | DECIMAL(15,4) | NOT NULL | إجمالي الأمر |
| paid_amount | DECIMAL(15,4) | DEFAULT 0 | المبلغ المدفوع |

---

## المجموعة الثامنة — Expenses

### expenses
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 branch_id | UUID | FK→branches | الفرع |
| 🔗 category_id | UUID | FK→expense_categories | التصنيف |
| 🔗 approved_by | UUID | FK→users NULL | من اعتمد |
| amount | DECIMAL(15,4) | NOT NULL | المبلغ |
| receipt_url | TEXT | NULL | رابط الإيصال |
| status | VARCHAR(50) | DEFAULT pending | pending/approved/rejected |

---

## ملخص العلاقات

| من | النوع | إلى | الوصف |
|---|---|---|---|
| plans | 1→N | subscriptions | باقة → اشتراكات متعددة |
| tenants | 1→N | subscriptions | tenant → سجلات اشتراك متعددة |
| branches | 1→N | users | فرع → مستخدمون متعددون |
| roles | 1→N | users | دور → مستخدمون متعددون |
| products | 1→N | stock | منتج → رصيد في كل فرع |
| products | 1→N | invoice_items | منتج → بنود فواتير متعددة |
| customers | 1→N | invoices | عميل → فواتير متعددة |
| customers | 1→N | installment_contracts | عميل → عقود تقسيط متعددة |
| invoices | 1→N | invoice_items | فاتورة → بنود متعددة |
| invoices | 1→1 | installment_contracts | فاتورة → عقد تقسيط واحد |
| installment_contracts | 1→N | installment_payments | عقد → أقساط متعددة |
| suppliers | 1→N | purchase_orders | مورد → أوامر شراء متعددة |
| expense_categories | 1→N | expenses | تصنيف → مصروفات متعددة |

---

## إحصائيات

- **إجمالي الجداول:** 30+ جدول
- **Foreign Keys:** 35+ علاقة
- **DECIMAL(15,4):** لكل الأرقام المالية — دقة عالية
- **JSONB:** roles.permissions, plans.features, offline_queue.payload
- **UNIQUE Constraints:** tenants.slug, users.email, stock(product_id+branch_id)

---

*Storify ERD Document v1.0 — جميع الحقوق محفوظة © 2026*

---

## تحديث v1.1 — Payment Methods & Fees

### جدول جديد: payment_methods
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| name | VARCHAR(100) | NOT NULL | فيزا / فلوسة / إنستاباي / Valu |
| type | VARCHAR(50) | NOT NULL | card \| wallet \| bnpl \| cash \| bank_transfer |
| fee_type | VARCHAR(20) | DEFAULT none | none \| percentage \| fixed \| both |
| fee_percentage | DECIMAL(5,2) | DEFAULT 0 | النسبة مثل 1.75 = 1.75% |
| fee_fixed | DECIMAL(10,2) | DEFAULT 0 | مبلغ ثابت مثل 2.00 ج |
| fee_bearer | VARCHAR(20) | DEFAULT merchant | customer \| merchant \| negotiable |
| is_active | BOOLEAN | DEFAULT true | هل طريقة الدفع مفعّلة؟ |
| notes | TEXT | NULL | ملاحظات: بنك مصر — عقد رقم 12345 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | تاريخ الإضافة |

### تعديل جدول: invoices — حقول جديدة
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔗 payment_method_id | UUID | FK→payment_methods | يستبدل payment_type النصي القديم |
| fee_percentage | DECIMAL(5,2) | DEFAULT 0 | النسبة المطبقة وقت البيع (محفوظة للتاريخ) |
| fee_fixed | DECIMAL(10,2) | DEFAULT 0 | المبلغ الثابت المطبق وقت البيع |
| fee_amount | DECIMAL(15,4) | DEFAULT 0 | المبلغ الفعلي للـ fee المحسوب |
| fee_bearer | VARCHAR(20) | DEFAULT merchant | customer \| merchant |
| fee_added_to_total | BOOLEAN | DEFAULT false | true = العميل يتحمل الـ fee |

> ⚠️ تُحفظ قيم الـ fee في الفاتورة وقت البيع — حتى لو تغيّرت إعدادات payment_methods لاحقاً

### جدول جديد: payment_fee_expenses
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 invoice_id | UUID | FK→invoices | الفاتورة المرتبطة |
| 🔗 payment_method_id | UUID | FK→payment_methods | طريقة الدفع |
| fee_amount | DECIMAL(15,4) | NOT NULL | مبلغ الرسوم |
| 🔗 branch_id | UUID | FK→branches | الفرع |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | يُنشأ تلقائياً — لا تدخل يدوي |

> يُملأ تلقائياً عند كل فاتورة بـ fee_bearer = merchant

### علاقات جديدة
| من | النوع | إلى | الوصف |
|---|---|---|---|
| payment_methods | 1→N | invoices | كل طريقة دفع تُستخدم في فواتير متعددة |
| invoices | 1→1 | payment_fee_expenses | كل فاتورة بـ merchant fee لها سجل مصروف |
| payment_methods | 1→N | payment_fee_expenses | كل طريقة دفع لها سجلات رسوم متعددة |

### إحصائيات محدّثة
- **إجمالي الجداول:** 33+ جدول (أُضيف 2 جداول جديدة)
- **Foreign Keys:** 38+ علاقة (أُضيفت 3 علاقات جديدة)

---
*آخر تحديث: v1.1 — أبريل 2026*

---

## تحديث v1.2 — Variants, Audit, Password Reset, Tenant Versioning

> **التاريخ:** 2026-05-10
> **مرجع:** `Storify_Patch_Notes_v1.2.md`

### تعديل master.tenants — حقول جديدة وإعادة تسمية
| الحقل | التغيير | الوصف |
|---|---|---|
| `slug` → `subdomain` | إعادة تسمية | يطابق `STORIFY_MASTER_DOCUMENT.md` و `.trae/phase1-mvp.md` |
| `db_name` → `schema_name` | إعادة تسمية | اسم الـ Postgres schema |
| `db_url` | محذوف | يُشتق من DATABASE_MASTER_URL + schema_name |
| `schema_version` | جديد INTEGER DEFAULT 0 | يتتبع آخر migration طُبق على tenant |
| `suspended_at` | جديد TIMESTAMPTZ | متى تم تعليق الحساب |
| `cancelled_at` | جديد TIMESTAMPTZ | متى تم إلغاء الحساب (الـ schema يُحفظ 30 يوم للتصدير) |

### تعديل products — تقسيم على variants
| الحقل | التغيير |
|---|---|
| `barcode` | محذوف من products → نُقل إلى product_variants |
| `cost_price` | محذوف من products → نُقل إلى product_variants |
| `sell_price` | محذوف من products → نُقل إلى product_variants |
| `description` | جديد TEXT |
| `has_variants` | جديد BOOLEAN DEFAULT false |

### جدول جديد: product_variants  ← CRITICAL
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 product_id | UUID | FK→products ON DELETE CASCADE | المنتج الأصلي |
| sku | VARCHAR(100) | NULL | SKU للمتغير |
| barcode | VARCHAR(100) | NULL | باركود للمتغير |
| attributes | JSONB | DEFAULT {} | `{"size":"L","color":"red"}` — فارغ للمنتجات بدون متغيرات |
| cost_price | DECIMAL(15,4) | NOT NULL | سعر التكلفة |
| sell_price | DECIMAL(15,4) | NOT NULL | سعر البيع |
| image_url | TEXT | NULL | صورة المتغير (تورث من products لو NULL) |
| is_active | BOOLEAN | DEFAULT true | متاح للبيع؟ |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

> ⚠️ UNIQUE(product_id, sku) | INDEX على barcode حيث NOT NULL
> **قاعدة:** كل منتج له على الأقل variant واحد. عند `has_variants = false`، يُنشأ variant افتراضي بـ `attributes = {}` تلقائياً.

### Foreign Key إعادة توجيه — من product_id إلى variant_id
| الجدول | الحقل القديم | الحقل الجديد |
|---|---|---|
| stock | product_id | variant_id |
| stock_movements | product_id | variant_id |
| stock_transfer_items | product_id | variant_id |
| invoice_items | product_id | variant_id |
| return_items | product_id | variant_id |
| purchase_order_items | product_id | variant_id |

> **استثناء:** `product_discounts.product_id` يبقى — الخصم يُطبق على كل المتغيرات.

### جدول جديد: audit_logs  ← مطلوب للامتثال المالي
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 actor_id | UUID | FK→users NULL | NULL لأحداث النظام |
| entity | VARCHAR(100) | NOT NULL | "invoice", "user", "permission" |
| entity_id | UUID | NULL | معرف الـ row المتأثر |
| action | VARCHAR(50) | NOT NULL | create, update, delete, approve, reject, login, login_failed |
| before | JSONB | NULL | الحالة قبل التعديل |
| after | JSONB | NULL | الحالة بعد التعديل |
| ip | INET | NULL | IP الطالب |
| user_agent | TEXT | NULL | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

> **Indexes:** (entity, entity_id) | (actor_id, created_at DESC) | (created_at DESC)
> **قاعدة:** الـ rows immutable — لا يوجد update/delete API.
> **أحداث إجبارية في Phase 1:** كل محاولات تسجيل الدخول، إنشاء/استرجاع الفواتير، موافقة/رفض التقسيط، تغييرات الصلاحيات، تفعيل/تعطيل المستخدمين، تعديل الأسعار، تعديلات المخزون اليدوية.

### جدول جديد: password_reset_tokens
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 user_id | UUID | FK→users ON DELETE CASCADE | المستخدم |
| token_hash | TEXT | UK NOT NULL | SHA-256 للـ raw token (الـ raw يُرسل للبريد فقط) |
| expires_at | TIMESTAMPTZ | NOT NULL | بعد ساعة من الإنشاء |
| used_at | TIMESTAMPTZ | NULL | NULL لحد ما يُستخدم — استخدام لمرة واحدة |
| ip | INET | NULL | IP الطالب |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

> **Rate limit:** 5 طلبات `forgot-password` لكل بريد في الساعة الواحدة.

### تعديل master.subscriptions — Paymob fields
| الحقل | النوع | الوصف |
|---|---|---|
| status (enum) | إضافة `'SUSPENDED'` | بين PAST_DUE و CANCELLED |
| provider | VARCHAR(50) DEFAULT 'paymob' | اسم مزود الدفع |
| provider_subscription_id | VARCHAR(200) | مرجع Paymob |
| provider_customer_id | VARCHAR(200) | عميل Paymob المحفوظ |
| provider_card_token | TEXT | بطاقة محفوظة (للدفع المتكرر) |
| last_payment_at | TIMESTAMPTZ | آخر دفعة ناجحة |
| next_billing_at | TIMESTAMPTZ | تاريخ الفاتورة القادمة |
| failed_attempts | INTEGER DEFAULT 0 | عداد الـ dunning |
| last_failure_reason | TEXT | لرؤية فريق الدعم |

### جدول جديد (Master DB): payment_attempts
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | CUID | PK | معرف فريد |
| 🔗 subscription_id | CUID | FK→subscriptions | الاشتراك |
| amount | DECIMAL(10,2) | NOT NULL | المبلغ |
| currency | VARCHAR(10) | DEFAULT 'EGP' | |
| status | ENUM | NOT NULL | SUCCESS / FAILED / PENDING / REFUNDED |
| provider | VARCHAR(50) | DEFAULT 'paymob' | |
| provider_transaction_id | VARCHAR(200) | UNIQUE | معرف معاملة Paymob |
| provider_response | JSONB | NULL | كامل response Paymob للفحص |
| error_code | VARCHAR(100) | NULL | |
| error_message | TEXT | NULL | |
| attempt_type | VARCHAR(50) | NOT NULL | initial / retry_3d / retry_7d / retry_14d / manual |
| attempted_at | TIMESTAMPTZ | DEFAULT NOW() | |

### تعديل tenant_settings — ETA configuration
| الحقل | النوع | الوصف |
|---|---|---|
| eta_enabled | BOOLEAN DEFAULT false | تفعيل التكامل مع ETA |
| eta_environment | VARCHAR(20) DEFAULT 'preprod' | preprod / production |
| eta_taxpayer_id | VARCHAR(50) | RIN — رقم تسجيل المنشأة |
| eta_activity_code | VARCHAR(20) | كود النشاط |
| eta_branch_code | VARCHAR(20) DEFAULT '0' | كود الفرع لدى ETA |
| eta_client_id | TEXT | (مشفر at-rest) |
| eta_client_secret | TEXT | (مشفر at-rest) |
| eta_signing_cert | TEXT | شهادة التوقيع PEM |
| eta_auto_submit | BOOLEAN DEFAULT true | إرسال تلقائي بعد البيع |
| eta_doc_type | VARCHAR(20) DEFAULT 'i' | i = فاتورة B2B \| r = إيصال B2C |

### تعديل invoices — ETA tracking
| الحقل | النوع | الوصف |
|---|---|---|
| eta_uuid | VARCHAR(100) | UUID من ETA بعد الموافقة |
| eta_long_id | VARCHAR(200) | المرجع الدائم في ETA |
| eta_internal_id | VARCHAR(50) UNIQUE | معرفنا الداخلي |
| eta_status | VARCHAR(50) DEFAULT 'not_required' | not_required / pending / submitted / accepted / rejected / failed |
| eta_submitted_at | TIMESTAMPTZ | |
| eta_accepted_at | TIMESTAMPTZ | |
| eta_qr_code | TEXT | QR كود base64 يُطبع على الإيصال |
| eta_doc_type | VARCHAR(20) | محفوظ من tenant_settings وقت الإرسال |
| eta_error | JSONB | أخطاء الـ validation عند الرفض |

### جدول جديد (Tenant Schema): eta_submissions
| الحقل | النوع | القيود | الوصف |
|---|---|---|---|
| 🔑 id | UUID | PK | معرف فريد |
| 🔗 invoice_id | UUID | NOT NULL FK→invoices | الفاتورة |
| attempt_number | INTEGER | NOT NULL DEFAULT 1 | رقم المحاولة (للـ retry) |
| direction | VARCHAR(20) | NOT NULL | submit / cancel / credit_note |
| request_payload | JSONB | NOT NULL | الـ JSON المُرسَل (موقّع) |
| response_body | JSONB | NULL | response من ETA |
| http_status | INTEGER | NULL | |
| eta_uuid | VARCHAR(100) | NULL | لو الإرسال نجح |
| status | VARCHAR(50) | NOT NULL | pending / accepted / rejected / failed |
| error_code | VARCHAR(50) | NULL | |
| error_message | TEXT | NULL | |
| submitted_at | TIMESTAMPTZ | DEFAULT NOW() | |

> **Append-only** — سجل تدقيقي لكل تفاعل مع ETA. مطلوب لحل النزاعات الضريبية.

### إحصائيات v1.2 (final)
- **إجمالي الجداول:** 38 جدول (Master 4 + Tenant 34)
  - Master DB: plans, tenants, subscriptions, **payment_attempts** (NEW)
  - Tenant: 34 جدول (3 جدد في v1.2: product_variants, audit_logs, password_reset_tokens, **+1 ETA: eta_submissions**)
- **Foreign Keys:** 43+ علاقة
- **حقول جديدة في master.tenants:** schema_version, suspended_at, cancelled_at
- **حقول جديدة في master.subscriptions:** provider, provider_subscription_id, provider_customer_id, provider_card_token, last_payment_at, next_billing_at, failed_attempts, last_failure_reason; status enum + SUSPENDED
- **حقول جديدة في tenant_settings:** 10 ETA config fields
- **حقول جديدة في invoices:** 9 ETA tracking fields

---
*آخر تحديث: v1.2 — مايو 2026 — يشمل ETA full integration + Paymob*
