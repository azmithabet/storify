import { z } from 'zod'

// itemType drives which itemDetails JSON shape is accepted. Kept as a string
// (not enum) so adding new business types later doesn't require a schema migration.
export const ITEM_TYPES = ['device', 'vehicle', 'appointment', 'other'] as const
export type ItemType = (typeof ITEM_TYPES)[number]

export const STATUS_VALUES = [
  'received',
  'scheduled',
  'diagnosed',
  'quoted',
  'approved',
  'in_progress',
  'ready',
  'delivered',
  'cancelled',
] as const
export type WorkOrderStatus = (typeof STATUS_VALUES)[number]

// State machine — what each status can transition to. 'delivered' and 'cancelled'
// are terminal. Centralized here so the validator on PATCH /:id/status, the
// frontend, and any audit reports all agree on what's legal.
export const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  received: ['scheduled', 'diagnosed', 'in_progress', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  diagnosed: ['quoted', 'in_progress', 'cancelled'],
  quoted: ['approved', 'cancelled'],
  approved: ['in_progress', 'cancelled'],
  in_progress: ['ready', 'cancelled'],
  ready: ['delivered', 'in_progress', 'cancelled'], // in_progress allowed for rework
  delivered: [],
  cancelled: [],
}

// Per-itemType shape for the JSON column. None of these are *required* —
// the work order can be created with a minimal payload and details filled in
// later. We only validate the shape when keys are present.
const deviceDetailsSchema = z
  .object({
    brand: z.string().optional(),
    model: z.string().optional(),
    imei: z.string().optional(),
    serialNumber: z.string().optional(),
    conditionNotes: z.string().optional(),
    photos: z.array(z.string().url()).optional(),
  })
  .strict()

const vehicleDetailsSchema = z
  .object({
    plate: z.string().optional(),
    vin: z.string().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    year: z.coerce.number().int().optional(),
    mileage: z.coerce.number().int().optional(),
  })
  .strict()

const appointmentDetailsSchema = z
  .object({
    notes: z.string().optional(),
  })
  .strict()

const otherDetailsSchema = z
  .object({
    description: z.string().optional(),
  })
  .strict()

export function parseItemDetails(itemType: ItemType, raw: unknown): Record<string, unknown> {
  const schema = (
    {
      device: deviceDetailsSchema,
      vehicle: vehicleDetailsSchema,
      appointment: appointmentDetailsSchema,
      other: otherDetailsSchema,
    } as const
  )[itemType]
  return schema.parse(raw ?? {})
}

const serviceLineSchema = z.object({
  serviceId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).default(1),
  // unitPrice is optional on create — if omitted, the service's defaultPrice
  // is snapshotted server-side. Once set on the work-order line, edits to the
  // catalog don't retroactively change quoted prices.
  unitPrice: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
})

export const createWorkOrderSchema = z.object({
  branchId: z.string().uuid(),
  customerId: z.string().uuid().optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  itemType: z.enum(ITEM_TYPES),
  itemDetails: z.record(z.string(), z.unknown()).default({}),
  scheduledAt: z.string().datetime().optional().nullable(),
  deposit: z.coerce.number().min(0).default(0),
  estimatedTotal: z.coerce.number().min(0).optional().nullable(),
  diagnosisNotes: z.string().optional().nullable(),
  customerNotes: z.string().optional().nullable(),
  services: z.array(serviceLineSchema).default([]),
})

export const updateWorkOrderSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  itemDetails: z.record(z.string(), z.unknown()).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  deposit: z.coerce.number().min(0).optional(),
  estimatedTotal: z.coerce.number().min(0).optional().nullable(),
  finalTotal: z.coerce.number().min(0).optional().nullable(),
  diagnosisNotes: z.string().optional().nullable(),
  workNotes: z.string().optional().nullable(),
  customerNotes: z.string().optional().nullable(),
})

export const transitionStatusSchema = z.object({
  status: z.enum(STATUS_VALUES),
  note: z.string().max(500).optional(),
})

export const addServiceSchema = serviceLineSchema

export const recordPaymentSchema = z.object({
  paymentMethodId: z.string().uuid(),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
})

export const listWorkOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(STATUS_VALUES).optional(),
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  assignedUserId: z.string().uuid().optional(),
  search: z.string().optional(), // matches ticketNumber
})
