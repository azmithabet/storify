# حِسبة — Payment Methods & Fees Update v1.1
> تحديث شامل لطرق الدفع والرسوم على كل الـ Documents
> **التاريخ:** أبريل 2026

---

## ملخص التغيير

طرق الدفع لها رسوم (fees) مختلفة — إهمالها يعني أرقام مالية غير دقيقة.
هذا التحديث يضيف نظام fees كامل لكل الـ documents.

---

## 1. طرق الدفع والـ Fees

| طريقة الدفع | الـ Fee النموذجية | من يتحملها؟ | كيف تُحسب؟ |
|---|---|---|---|
| فيزا / ماستركارد | 1.5% — 2.5% | المحل عادةً | % من الفاتورة |
| فلوسة | 1.75% أو ثابت | المحل | % أو ثابت |
| إنستاباي | 0% — 0.5% | المحل | % صغيرة |
| Valu / Sympl | 2% — 5% | المحل دائماً | % من التمويل |
| تحويل بنكي | مبلغ ثابت | يتفاوت | ثابت للعملية |
| كاش | 0% | لا يوجد | — |

---

## 2. تحديث ERD

### جدول جديد: payment_methods
```sql
payment_methods
─────────────────────────────────────
🔑 id               UUID          PK
   name             VARCHAR(100)  NOT NULL    -- فيزا / فلوسة / إنستاباي / Valu
   type             VARCHAR(50)   NOT NULL    -- card|wallet|bnpl|cash|bank_transfer
   fee_type         VARCHAR(20)   DEFAULT none -- none|percentage|fixed|both
   fee_percentage   DECIMAL(5,2)  DEFAULT 0   -- 1.75 = 1.75%
   fee_fixed        DECIMAL(10,2) DEFAULT 0   -- 2.00 ج ثابتة
   fee_bearer       VARCHAR(20)   DEFAULT merchant -- customer|merchant|negotiable
   is_active        BOOLEAN       DEFAULT true
   notes            TEXT          NULL
   created_at       TIMESTAMPTZ   DEFAULT NOW()
```

### تعديل invoices — حقول جديدة
```sql
-- حقول تُضاف على invoices
🔗 payment_method_id   UUID          FK→payment_methods  -- بدل payment_type النصي
   fee_percentage      DECIMAL(5,2)  DEFAULT 0
   fee_fixed           DECIMAL(10,2) DEFAULT 0
   fee_amount          DECIMAL(15,4) DEFAULT 0           -- المبلغ الفعلي المحسوب
   fee_bearer          VARCHAR(20)   DEFAULT merchant
   fee_added_to_total  BOOLEAN       DEFAULT false        -- true لو العميل يتحملها
```

### جدول جديد: payment_fee_expenses
```sql
payment_fee_expenses
─────────────────────────────────────
🔑 id                  UUID          PK
🔗 invoice_id          UUID          FK→invoices
🔗 payment_method_id   UUID          FK→payment_methods
   fee_amount          DECIMAL(15,4) NOT NULL
🔗 branch_id           UUID          FK→branches
   created_at          TIMESTAMPTZ   DEFAULT NOW()
```
> يُملأ تلقائياً لما fee_bearer = merchant — بدون تدخل يدوي

---

## 3. تحديث Logic Flow

```
[START] الكاشير يجهّز الفاتورة
   ↓
[1] اختيار طريقة الدفع — يُعرض الـ fee مع كل طريقة
   مثال: [فيزا — 1.75%] [فلوسة — 2ج] [إنستاباي — 0%]
   ↓
[?] هل فيه fees؟
   ├── ❌ لا (كاش/إنستاباي 0%) → إتمام البيع مباشرة
   └── ✅ نعم → حساب fee تلقائياً
   ↓
[2] حساب الـ fee:
   percentage: fee = total × (fee_pct / 100)
   fixed:      fee = fee_fixed
   both:       fee = (total × fee_pct/100) + fee_fixed
   ↓
[?] fee_bearer = negotiable؟
   ├── ✅ نعم → الكاشير يختار مين يتحمل
   └── ❌ لا  → محدد مسبقاً
   ↓
[?] مين يتحمل؟
   ├── customer → total_amount += fee → العميل يدفع أكتر
   └── merchant → total_amount ثابت → fee كمصروف تلقائي
   ↓
[3] حفظ الفاتورة مع كل تفاصيل الـ fee
   ↓
[?] merchant يتحمل؟
   ├── ✅ نعم → إنشاء payment_fee_expenses تلقائياً
   └── ❌ لا  → لا يوجد مصروف
   ↓
[END ✅]
```

---

## 4. قواعد الأعمال

### صيغ الحساب
| الحالة | الصيغة | مثال |
|---|---|---|
| percentage | fee = total × (pct/100) | 420 × 1.75% = 7.35 ج |
| fixed | fee = fee_fixed | 2.00 ج |
| both | fee = (total × pct/100) + fixed | 420×1%+2 = 6.20 ج |
| none | fee = 0 | — |

### تأثير الـ fee على التقارير
| fee_bearer | على الفاتورة | على التقارير |
|---|---|---|
| customer | total += fee_amount | الإيراد يشمل الـ fee |
| merchant | total لا يتغير | يُسجَّل كمصروف تلقائي |
| negotiable | يحدده الكاشير | حسب الاختيار |

### صلاحيات الـ Fees
| الدور | يرى الـ fee | يغيّر fee_bearer | يعدّل الإعدادات |
|---|---|---|---|
| Super Admin | ✅ | ✅ | ✅ |
| Branch Manager | ✅ | ✅ (negotiable فقط) | ❌ |
| Cashier | ✅ (عرض) | ✅ (negotiable فقط) | ❌ |
| Accountant | ✅ | ❌ | ❌ |

---

## 5. تقرير الرسوم الجديد

| طريقة الدفع | العمليات | إجمالي Fees | تحملها العميل | تحملها المحل |
|---|---|---|---|---|
| فيزا/ماستركارد | 45 | 892 ج | 634 ج | 258 ج |
| فلوسة | 23 | 201 ج | 80 ج | 121 ج |
| إنستاباي | 18 | 0 ج | 0 ج | 0 ج |
| Valu/Sympl | 8 | 1,200 ج | 0 ج | 1,200 ج |

### تأثير على الأرباح والخسائر
```
قبل التحديث:  صافي الربح = 46,950 ج  ← مبالغ فيه
بعد التحديث: صافي الربح = 45,321 ج  ← دقيق
الفرق:        −1,629 ج  ← كانت غير مرصودة
```

---

## 6. تحديث POS Wireframe

**قبل:** `[كاش] [كارت] [تقسيط]`

**بعد:**
```
[💵 كاش — 0%]  [فيزا — 1.75%]  [فلوسة — 2ج]  [إنستاباي — 0%]  [Valu]  [📋 تقسيط]

عند اختيار فيزا:
┌─────────────────────────────────┐
│ المجموع:    420.00 ج           │
│ fee فيزا:  + 7.35 ج (1.75%)   │
│ الإجمالي:   427.35 ج           │
│                                 │
│ ○ العميل يتحمل الـ fee         │
│ ● المحل يتحمل الـ fee          │
└─────────────────────────────────┘
```

---

## 7. Backend Code

```typescript
function calculateFee(totalAmount: Decimal, paymentMethod: PaymentMethod) {
  if (paymentMethod.feeType === 'none')
    return { feeAmount: new Decimal(0), feeAddedToTotal: false };

  let fee = new Decimal(0);

  if (['percentage','both'].includes(paymentMethod.feeType))
    fee = fee.plus(totalAmount.times(paymentMethod.feePercentage).dividedBy(100));

  if (['fixed','both'].includes(paymentMethod.feeType))
    fee = fee.plus(paymentMethod.feeFixed);

  return {
    feeAmount: fee.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
    feeAddedToTotal: paymentMethod.feeBearer === 'customer',
  };
}
```

---

## 8. Seed الافتراضي لكل tenant جديد

| الاسم | النوع | fee_type | fee | fee_bearer |
|---|---|---|---|---|
| كاش | cash | none | 0 | — |
| فيزا / ماستركارد | card | percentage | 1.75% | merchant |
| فلوسة | wallet | fixed | 2 ج | merchant |
| إنستاباي | wallet | none | 0 | — |
| Valu | bnpl | percentage | 3% | merchant |
| تحويل بنكي | bank_transfer | fixed | 5 ج | merchant |

---

## 9. Migrations المطلوبة

```
1. CREATE TABLE payment_methods (في كل tenant schema)
2. ALTER TABLE invoices ADD COLUMNS (payment_method_id + fee fields)
3. CREATE TABLE payment_fee_expenses
4. Seed طرق الدفع الافتراضية
5. Migration للبيانات القديمة: payment_type → payment_method_id
```

---

*حِسبة Payment Methods & Fees Update v1.1 — © 2026*
