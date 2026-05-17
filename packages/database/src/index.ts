export { masterDb } from './prisma'
export { PrismaClient, Prisma } from './generated/client'
export type { Plan, Tenant, Subscription, PaymentAttempt, PlatformAdmin, PlatformAuditLog } from './generated/client'
export { runTenantMigrations, migrateAllTenants } from './migrate-tenants'

// Tenant schema client (Step 05+)
export { PrismaClient as TenantPrismaClient } from './generated/tenant'
export type {
  User,
  Role,
  Branch,
  PasswordResetToken,
  TenantSetting,
  Category,
  TaxRate,
  Product,
  ProductVariant,
  Stock,
  StockMovement,
  StockTransfer,
  StockTransferItem,
  Currency,
  PaymentMethod,
  Customer,
  CustomerDocument,
  Coupon,
  ProductDiscount,
  Invoice,
  InvoiceItem,
  PaymentFeeExpense,
  Return,
  ReturnItem,
  InstallmentContract,
  InstallmentPayment,
  ExternalFinancing,
  Supplier,
  SupplierTransaction,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseReceipt,
  PurchasePayment,
  ExpenseCategory,
  Expense,
  OfflineQueue,
  PrintTemplate,
  AuditLog,
  EtaSubmission,
} from './generated/tenant'
