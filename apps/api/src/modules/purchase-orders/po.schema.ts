import { z } from 'zod'

export const createPoSchema = z.object({
  supplierId: z.string().uuid(),
  branchId: z.string().uuid(),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentType: z.string().max(50).optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().positive(),
        unitCost: z.number().positive(),
      }),
    )
    .min(1),
})

export const receivePoSchema = z.object({
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
  invoiceImageUrl: z.string().url().optional(),
})

export const poPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.string().max(50).optional(),
  receiptUrl: z.string().url().optional(),
})

export const listPoSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
})

export type CreatePoInput = z.infer<typeof createPoSchema>
export type ReceivePoInput = z.infer<typeof receivePoSchema>
export type PoPaymentInput = z.infer<typeof poPaymentSchema>
