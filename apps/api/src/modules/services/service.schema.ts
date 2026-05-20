import { z } from 'zod'

// ─── Service categories ─────────────────────────────────────────────────────
export const createServiceCategorySchema = z.object({
  name: z.string().trim().min(1, 'الاسم مطلوب').max(100),
})

export const updateServiceCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
})

// ─── Services (catalog) ─────────────────────────────────────────────────────
export const createServiceSchema = z.object({
  name: z.string().trim().min(1, 'الاسم مطلوب').max(200),
  description: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  defaultPrice: z.coerce.number().min(0, 'السعر يجب أن يكون موجباً'),
  estimatedDurationMinutes: z.coerce.number().int().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const updateServiceSchema = createServiceSchema.partial()

export const listServicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional(),
})
