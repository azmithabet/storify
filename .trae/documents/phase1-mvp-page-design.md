# Phase 1 MVP Page Designs (Desktop-first)

## Global design (applies to all pages)
- Layout: Desktop-first with a fixed left sidebar + top bar; content area uses CSS Grid for dense tables and card summaries.
- Responsive behavior:
  - ≥1200px: persistent sidebar (240px) + main content.
  - 768–1199px: collapsible sidebar (icon-only) + main content.
  - <768px: stacked layout; tables become card lists; POS uses full-width stepper.
- Global styles / tokens:
  - Background: #0B1220 (app shell) with white/near-white surfaces for tables/forms.
  - Primary: #2563EB; Success: #16A34A; Danger: #DC2626; Warning: #F59E0B.
  - Typography: 14px base; 12px table metadata; 18–24px section titles.
  - Buttons: Primary/Secondary/Ghost; hover uses +6% brightness; disabled at 40% opacity.
- Shared components:
  - AppShell: Sidebar nav (POS, Products, Stock, Customers, Invoices, Installments, Reports, Settings).
  - TopBar: Tenant badge (subdomain), branch/location selector (only if API supports), global search (optional: product/customer quick search).
  - TenantResolver: Reads subdomain from hostname and shows an inline error state when invalid/unrecognized.
- Meta information (defaults; per page overrides below):
  - Title format: "{Page} • Storify"
  - Description: "Retail operations for your tenant store"
  - Open Graph: title mirrors page title; type = website.

---

## Page: POS
- Meta:
  - Title: "POS • Storify"
  - Description: "Create a sale, take payment, and issue an invoice"
- Page structure: Two-column operational workspace.
- Layout:
  - Left (60%): Product search + cart table.
  - Right (40%): Totals + customer attach + payment + submit.
- Sections & components:
  1. Product Search Bar
     - Input with barcode-friendly focus behavior.
     - Results dropdown with name, price, stock indicator.
  2. Cart Table
     - Columns: Product, Unit price, Qty (stepper), Line total, Remove.
     - Inline stock warnings (e.g., red badge) when qty exceeds available.
  3. Customer Attach (optional)
     - Search/select existing customer; quick-create modal (minimal fields).
  4. Totals Panel
     - Subtotal, discounts (only if supported), fees/taxes (only if returned by API), total.
  5. Payment Panel
     - Payment method selector; amount received (if needed); change due.
  6. Submit / Confirmation
     - Primary CTA: “Complete Sale”.
     - Success state: invoice number + link to invoice details + Print button (if supported).
     - Failure state: inline API error with retry.

---

## Page: Products
- Meta:
  - Title: "Products • Storify"
  - Description: "Maintain product catalog"
- Page structure: Table-first CRUD.
- Layout:
  - Header row with page title + “New Product” button.
  - Filters row (search + active status).
  - Main table grid; right-side drawer for create/edit.
- Sections & components:
  1. Products Table
     - Columns: Name, SKU/Barcode, Price, Active, Stock (read-only).
  2. Product Form Drawer
     - Fields: name, SKU, barcode, unit price, active.
     - Save/Cancel; inline validation; API error display.

---

## Page: Stock
- Meta:
  - Title: "Stock • Storify"
  - Description: "View and adjust inventory"
- Page structure: Summary + operational logs.
- Layout:
  - Top: stock summary table.
  - Bottom: movement history table with filters.
- Sections & components:
  1. Stock Overview
     - Columns: Product, On-hand, Location (if any), Updated at.
  2. Adjustment Modal
     - Fields: product, adjustment type (in/out), quantity, reason, notes.
  3. Movement History
     - Filters: date range, product, type.
     - Row click opens movement details side panel.

---

## Page: Customers
- Meta:
  - Title: "Customers • Storify"
  - Description: "Manage customer profiles"
- Page structure: Master list + details.
- Layout:
  - Customers list table.
  - Details uses a dedicated route `/customers/:id` with tabs.
- Sections & components:
  1. Customers Table
     - Columns: Name, Phone, Email, Balance/Receivables (if provided), Actions.
  2. Customer Form Drawer
     - Minimal fields required by API.
  3. Customer Details (tabs)
     - Profile, Invoices, Installments.

---

## Page: Invoices
- Meta:
  - Title: "Invoices • Storify"
  - Description: "Browse and manage invoices"
- Page structure: List + details.
- Layout:
  - Invoice list table with filters.
  - Details page shows printable document layout.
- Sections & components:
  1. Invoice List
     - Filters: date range, status, customer.
     - Columns: Invoice no, Customer, Total, Balance, Status, Created.
  2. Invoice Details
     - Header: invoice number, customer, status.
     - Items table: product, qty, unit price, line total.
     - Totals: subtotal, fees/taxes (if any), total, paid, balance.
     - Actions: Print, Export (if supported), Create installment plan (if enabled).

---

## Page: Installments
- Meta:
  - Title: "Installments • Storify"
  - Description: "Create and track installment plans"
- Page structure: Work queue + plan details.
- Layout:
  - Left: plans list.
  - Right: plan details with schedule and payment posting.
- Sections & components:
  1. Plans List
     - Filters: status, date, customer.
     - Columns: Invoice no, Customer, Total, Balance, Status.
  2. Plan Details
     - Summary cards: total, paid, balance, next due.
     - Schedule table: due date, amount, status.
  3. Actions
     - Create plan (from invoice) OR from this page (invoice picker).
     - Approve/Reject buttons (only for manager role; only if API supports).
     - Post payment modal: amount, method, date, notes.

---

## Page: Reports
- Meta:
  - Title: "Reports • Storify"
  - Description: "Sales and receivables insights"
- Page structure: Dashboard with charts + tables.
- Layout:
  - Top KPI cards (sales, invoices count, receivables).
  - Middle: chart grid (2 columns).
  - Bottom: detailed tables.
- Sections & components:
  1. Filters Bar
     - Date range, branch/location (if supported), export.
  2. KPI Cards
     - Values sourced from API aggregates.
  3. Charts
     - Sales trend (line), Top products (bar).
  4. Tables
     - Receivables / Installments summary table.

---

## Page: Settings
- Meta:
  - Title: "Settings • Storify"
  - Description: "Configure tenant store settings"
- Page structure: Left settings nav + right content.
- Layout:
  - Vertical tabs: Store profile, Payments/Fees/Taxes, Users & Roles (if supported).
- Sections & components:
  1. Store Profile
     - Fields: store name, address, phone, currency/timezone (as supported by API).
  2. Payments/Fees/Taxes
     - Payment methods table + add/edit modal (only if supported by API).
     - Fee rules/tax toggles (only if supported by API).
  3. Users & Roles
     - Staff list + invite/create user modal (only if supported by API).
     - Role selector per user.
