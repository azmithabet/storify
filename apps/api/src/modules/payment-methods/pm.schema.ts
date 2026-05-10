import { z } from 'zod'

export const createPmSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['cash', 'card', 'ewallet', 'bnpl', 'bank_transfer']),
  feeType: z.enum(['none', 'percentage', 'fixed', 'both']).default('none'),
  feePercentage: z.number().min(0).default(0),
  feeFixed: z.number().min(0).default(0),
  feeBearer: z.enum(['customer', 'merchant', 'negotiable']).default('merchant'),
  notes: z.string().optional(),
})

export const updatePmSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  feeType: z.enum(['none', 'percentage', 'fixed', 'both']).optional(),
  feePercentage: z.number().min(0).optional(),
  feeFixed: z.number().min(0).optional(),
  feeBearer: z.enum(['customer', 'merchant', 'negotiable']).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional().nullable(),
})

export type CreatePmInput = z.infer<typeof createPmSchema>
export type UpdatePmInput = z.infer<typeof updatePmSchema>
