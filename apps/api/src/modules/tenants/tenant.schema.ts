import { z } from 'zod'

export const registerTenantSchema = z.object({
  name: z.string().min(2).max(200),
  subdomain: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'الـ subdomain يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام وشَرطة فقط'),
  planSlug: z.enum(['starter', 'professional', 'enterprise']),
  ownerName: z.string().min(2).max(200),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
})

export type RegisterTenantInput = z.infer<typeof registerTenantSchema>
