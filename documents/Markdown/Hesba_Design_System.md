# Storify — Design System v1.0
> نظام التصميم الكامل — Colors · Typography · Spacing · Components · Patterns · RTL
> **الإصدار:** 1.0.0 | **التاريخ:** أبريل 2026

---

## 1. Color System

### Brand — Indigo Scale
| Token | Hex | الاستخدام |
|---|---|---|
| brand-50 | #EEF2FF | خلفيات خفيفة، hover states |
| brand-200 | #C7D2FE | حدود خفيفة |
| brand-400 | #818CF8 | أيقونات، sidebar active |
| **brand-500 ★** | **#6366F1** | **اللون الأساسي** |
| brand-600 | #4F46E5 | Primary buttons |
| brand-800 | #3730A3 | نص على خلفية فاتحة |

### Neutral Gray Scale
```
#F8FAFC (50)  #F1F5F9 (100)  #E2E8F0 (200)  #CBD5E1 (300)  #94A3B8 (400)
#64748B (500)  #475569 (600)  #334155 (700)  #1E293B (800)  #0F172A (900)
```

### Semantic Colors
| اللون | Hex | الاستخدام في Storify |
|---|---|---|
| Success | #10B981 | فاتورة مكتملة، موافقة، مخزون كافٍ |
| Warning | #F59E0B | انتظار موافقة، مخزون منخفض، fees |
| Danger | #EF4444 | نفذ، خطأ، أقساط متأخرة |
| Info | #3B82F6 | تمويل خارجي، معلومات، روابط |

### Accent Colors
| اللون | Hex | الاستخدام |
|---|---|---|
| Pink | #EC4899 | Highlights، SaaS branding |
| Cyan | #06B6D4 | Charts ثانوية |
| Violet | #8B5CF6 | التقسيط وعقوده |
| Teal | #14B8A6 | تحويلات المخزون |

---

## 2. Typography

### Font Families
| العائلة | الاسم | الاستخدام |
|---|---|---|
| Display | Syne | العناوين الكبيرة فقط (page titles) |
| Body | IBM Plex Sans Arabic | كل الـ UI والنصوص العربية |
| Monospace | JetBrains Mono | أرقام، كود، timestamps، أسعار |

### Type Scale
| Token | الحجم | الوزن | الاستخدام |
|---|---|---|---|
| text-5xl | 48px | 700 | Hero titles فقط |
| text-4xl | 36px | 700 | Page titles |
| text-3xl | 30px | 600 | Section headings |
| text-2xl | 24px | 600 | Card titles |
| text-xl | 20px | 500 | Subheadings |
| text-lg | 18px | 500 | Important body |
| **text-base ★** | **16px** | **400** | **Body text — الافتراضي** |
| text-sm | 14px | 400 | Secondary text |
| text-xs | 12px | 500 | Badges، hints |

---

## 3. Spacing & Grid

### Spacing Scale (4px base)
| Token | القيمة | الاستخدام |
|---|---|---|
| sp-1 | 4px | padding داخلي صغير |
| sp-2 | 8px | gap بين العناصر الصغيرة |
| **sp-4 ★** | **16px** | **padding الـ cards — الأكثر استخداماً** |
| sp-6 | 24px | margin بين الـ groups |
| sp-8 | 32px | padding الصفحات |
| sp-12 | 48px | section padding |

### Grid Layouts
| الاستخدام | الـ Layout | الـ Gap |
|---|---|---|
| Dashboard Stats | 4 columns equal | 14px |
| Content + Sidebar | fluid + 360px fixed | 16px |
| Form Fields | 2 columns equal | 16px |
| Product Grid POS | auto-fill minmax(130px, 1fr) | 10px |
| Branch Cards | 3 columns equal | 14px |

### Border Radius
| Token | القيمة | الاستخدام |
|---|---|---|
| r-sm | 4px | Badges صغيرة |
| r-md | 8px | Buttons، inputs |
| r-lg | 12px | Cards صغيرة |
| r-xl | 16px | Cards كبيرة، modals |
| r-2xl | 24px | Feature cards |
| r-full | 9999px | Pills، toggles |

---

## 4. Shadows & Elevation
| Token | الاستخدام |
|---|---|
| shadow-sm | Default cards، inputs |
| shadow-md | Hovered cards، dropdowns |
| shadow-lg | Modals، popovers |
| shadow-xl | Sheets، full overlays |
| shadow-brand | Primary buttons فقط |

---

## 5. Motion & Animation
| Token | المدة | الاستخدام |
|---|---|---|
| ease-fast | 150ms | Hover states، colors |
| ease-normal | 200ms | Buttons، toggles — الافتراضي |
| ease-slow | 300ms | Modals، page transitions |
| spring | 400ms | Cards expand، drag & drop |

### Animations
| الـ Animation | المدة | الاستخدام |
|---|---|---|
| fadeInUp | 400ms | Page content عند load |
| pulse | 1500ms ∞ | Status dots، live |
| spin | 1000ms linear | Loading spinners |
| shimmer | 1500ms ∞ | Skeleton loading |

---

## 6. Buttons

### Variants
| Variant | الـ BG | الاستخدام |
|---|---|---|
| Primary | brand-600 | CTA رئيسي — واحد في الصفحة |
| Secondary | gray-100 | ثانوي، مجاور للـ primary |
| Outline | transparent + brand border | اختيار بديل |
| Ghost | transparent | Table actions، sidebar items |
| Danger | danger-500 | حذف، إلغاء |
| Success | success-500 | تأكيد، موافقة |

### Sizes
| Size | Padding | الاستخدام |
|---|---|---|
| xs | 4px 10px | Inline actions |
| sm | 6px 12px | Table actions |
| **md ★** | **8px 16px** | **الأكثر استخداماً** |
| lg | 11px 22px | Page-level CTAs |
| xl | 14px 28px | Hero CTAs فقط |

---

## 7. Form Elements

### Input States
| الحالة | Border | Shadow |
|---|---|---|
| Default | 1.5px solid gray-200 | none |
| Hover | 1.5px solid gray-300 | none |
| Focus | 1.5px solid brand-500 | 0 0 0 3px brand/12% |
| Error | 1.5px solid danger-500 | 0 0 0 3px danger/12% |
| Success | 1.5px solid success-500 | none |
| Disabled | 1.5px solid gray-200 | bg: gray-100 |

---

## 8. Badges & Tags
| Token | الـ BG | الـ Text | الاستخدام |
|---|---|---|---|
| badge-brand | brand-100 | brand-800 | باقات، مميزات |
| badge-success | success-50 | success-700 | مكتمل، نشط |
| badge-warning | warning-50 | warning-700 | انتظار، تنبيه |
| badge-danger | danger-50 | danger-700 | نفذ، متأخر |
| badge-info | info-50 | info-700 | تمويل خارجي |
| badge-gray | gray-100 | gray-700 | معطّل، neutral |

> **قاعدة:** دائماً badge-dot أو icon مع اللون — لمراعاة الـ color blindness

---

## 9. Alerts & Toasts

### متى تستخدم؟
- **Alerts:** حالات ثابتة في الصفحة (مخزون نفذ، اشتراك منتهي)
- **Toasts:** أحداث لحظية (تم الحفظ، حدث خطأ)
- **Danger alerts:** لا تختفي تلقائياً
- **Success toasts:** تختفي بعد 3 ثوانٍ

---

## 10. Cards & Stats

### Card Variants
| النوع | Shadow | الاستخدام |
|---|---|---|
| Default | shadow-sm | الكتلة الأساسية |
| Elevated | shadow-md | محتوى مهم |
| Flat | none | صفحات كثيفة |
| Brand | none + brand-50 bg | Plan info |

### Stat Card
```
Accent bar (3px) → اليمين
Label: text-xs + uppercase + gray-500
Value: font-mono + 28px + bold
Change: text-xs + success/danger color
```

---

## 11. Tables

### Column Colors
| نوع البيانات | اللون |
|---|---|
| المبالغ والأسعار | brand-700 + font-mono |
| الكميات الكافية | success-600 |
| الكميات المنخفضة | warning-600 |
| الكميات الصفرية | danger-600 + bold |
| التواريخ | gray-500 |
| IDs والأكواد | gray-500 + font-mono |

---

## 14. Icons

### Sizes
| الحجم | الـ px | الاستخدام |
|---|---|---|
| xs | 12px | داخل badges |
| sm | 16px | Sidebar، table actions |
| **md ★** | **20px** | **الأكثر استخداماً** |
| lg | 24px | Page headers |
| xl | 32px | Empty states |

---

## 15. RTL Guidelines

| العنصر | القاعدة |
|---|---|
| HTML | `dir="rtl"` على الـ html |
| Layout | Sidebar اليمين، Content اليسار |
| Numbers | `dir="ltr"` + inline-block |
| Active Border | border-right مش border-left |
| Input Icon | padding-right مش padding-left |
| Date | يوم/شهر/سنة |
| Time | 12-hour + ص/م |

---

## 16. Accessibility (WCAG 2.1 AA)
- **Color Contrast:** 4.5:1 للنص العادي
- **Focus States:** 3px ring بلون brand-500
- **Keyboard Nav:** Tab order منطقي + Escape للإغلاق
- **Screen Readers:** aria-label على كل btn-icon-only
- **Error States:** Icon + نص + لون (مش لون بس)
- **Touch Targets:** min 44×44px
- **Reduced Motion:** prefers-reduced-motion يوقف الـ animations

---

## 17. CSS Variables Reference

```css
:root {
  /* Brand */
  --brand-500: #6366F1;  --brand-600: #4F46E5;

  /* Typography */
  --font-display: 'Syne', sans-serif;
  --font-body: 'IBM Plex Sans Arabic', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing */
  --sp-1: 0.25rem;  --sp-2: 0.5rem;  --sp-4: 1rem;
  --sp-6: 1.5rem;   --sp-8: 2rem;    --sp-12: 3rem;

  /* Radius */
  --r-sm: 0.25rem;  --r-md: 0.5rem;  --r-lg: 0.75rem;
  --r-xl: 1rem;     --r-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0/.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0/.1);
  --shadow-brand: 0 4px 14px 0 rgb(99 102 241/.3);

  /* Transitions */
  --ease-fast: 150ms ease;
  --ease-normal: 200ms ease;
  --ease-slow: 300ms ease;

  /* Z-Index */
  --z-dropdown: 100;  --z-modal: 400;  --z-toast: 500;
}
```

---

*Storify Design System v1.0 — © 2026*
