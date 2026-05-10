---
title: Storify Phase-1 MVP Requirements
last_updated: 2026-05-02
language: en
---

# Scope

Phase-1 MVP includes:

- POS
- Products
- Stock
- Customers
- Invoices
- Installments (internal)
- Reports
- Settings

# Core Architecture Decisions

## Multi-tenant

- Tenant resolution source: `subdomain` (preferred term; used for routing and provisioning).
- Data isolation: PostgreSQL schemas per tenant: `tenant_{subdomain}`.
- Master DB holds SaaS/admin tables (plans, tenants, subscriptions).
- Every API request must resolve tenant first, then query tenant schema only.

## Backend

- Runtime: Node.js + TypeScript.
- Web framework: Fastify.
- Validation: Zod.
- Authentication:
  - Access token: JWT (short-lived).
  - Refresh token: JWT in HttpOnly cookie.
- Authorization:
  - RBAC via roles + JSON permissions.
  - Feature guard via plan features.

## Frontend

- React + Vite + Tailwind.
- State:
  - Server state: TanStack Query.
  - Client state: Zustand.
- Routing: react-router-dom.

# Payment Methods & Fees (v1.1)

- Payment methods are configurable per tenant.
- Fees supported: none / percentage / fixed / both.
- Fee bearer:
  - Default selection in POS: `customer`.
  - If payment method is `negotiable`, only Manager can override fee bearer at checkout.
- If fee bearer is `customer`: fee is added to invoice total.
- If fee bearer is `merchant`: invoice total remains unchanged and a fee expense record is created.

# Minimal Functional Flows

## Tenant registration

- Register tenant (store name, subdomain, plan, owner credentials).
- Provision tenant schema.
- Seed:
  - Default roles.
  - Default branch.
  - Default tenant settings.
  - Default currency.
  - Default payment methods (with fees).

## POS sale

- Add products by search or barcode.
- Validate stock availability.
- Select payment method and compute fee.
- Persist invoice + items.
- Update stock and create stock movements.
- If merchant bears fee, create payment fee expense.

## Installments (internal)

- Cashier creates an installment contract as `pending_approval`.
- Manager approves → activates contract, finalizes sale, generates schedule.

# Naming & API Conventions

- Tenant identifier field name: `subdomain`.
- Tenant schema field name: `schema_name`.
- API responses use a consistent success/error envelope.

