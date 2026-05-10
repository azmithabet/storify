import { z } from 'zod'

export const createInvoiceSchema = z.object({
  branchId: z.string().uuid(),
  paymentMethodId: z.string().uuid(),
  currencyId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  couponCode: z.string().optional(),
  feeBearer: z.enum(['customer', 'merchant']).optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
      }),
    )
    .min(1),
})

export const listInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  customerId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  status: z.string().optional(),
  from: z.string().optional(), // ISO date string
  to: z.string().optional(),
})

export const returnInvoiceSchema = z.object({
  returnType: z.enum(['refund', 'credit']),
  reason: z.string().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().positive(),
        restock: z.boolean().default(true),
      }),
    )
    .min(1),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type ReturnInvoiceInput = z.infer<typeof returnInvoiceSchema>
