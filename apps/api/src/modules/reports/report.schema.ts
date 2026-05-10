import { z } from 'zod'

export const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD').optional(),
  branchId: z.string().uuid().optional(),
  format: z.enum(['json', 'excel']).default('json'),
})

export const salesReportSchema = dateRangeSchema.extend({
  cashierId: z.string().uuid().optional(),
  paymentMethodId: z.string().uuid().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
})

export const stockReportSchema = z.object({
  branchId: z.string().uuid().optional(),
  lowStockOnly: z.enum(['true', 'false']).default('false'),
  format: z.enum(['json', 'excel']).default('json'),
})

export const installmentsReportSchema = z.object({
  branchId: z.string().uuid().optional(),
  status: z.enum(['active', 'overdue', 'completed', 'pending_approval']).optional(),
  format: z.enum(['json', 'excel']).default('json'),
})

export const feesReportSchema = dateRangeSchema

export const profitLossSchema = dateRangeSchema
