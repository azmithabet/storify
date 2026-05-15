import { z } from 'zod'

export const listStockSchema = z.object({
  branchId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  lowStock: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const adjustStockSchema = z.object({
  variantId: z.string().uuid(),
  branchId: z.string().uuid(),
  quantity: z.number().int().refine((n) => n !== 0, { message: 'quantity cannot be zero' }),
  reason: z.string().min(1),
  note: z.string().optional(),
})

export const setMinQuantitySchema = z.object({
  minQuantity: z.number().int().min(0),
})

export const listMovementsSchema = z.object({
  variantId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  type: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const createTransferSchema = z.object({
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
})

export const approveTransferSchema = z.object({
  action: z.enum(['approve', 'reject']),
})

export type AdjustStockInput = z.infer<typeof adjustStockSchema>
export type CreateTransferInput = z.infer<typeof createTransferSchema>
