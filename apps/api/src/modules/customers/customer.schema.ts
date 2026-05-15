import { z } from 'zod'

export const createCustomerSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().max(50).optional(),
  nationalId: z.string().max(50).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

export const updateCustomerSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).optional().nullable(),
  nationalId: z.string().max(50).optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // Cap raised to 500 so the Installments customer dropdown can preload the
  // full list. Pagination still applies for >500 customer tenants.
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().optional(),
})

export const documentUploadSchema = z.object({
  docType: z.string().min(1).max(100),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/pdf']),
  fileName: z.string().min(1),
})

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
