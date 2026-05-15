import type { BadgeVariant } from '@/components/ui/Badge'

/**
 * Status code → display label + Badge variant. One canonical map per entity
 * so Arabic copy and color coding stay consistent across pages.
 *
 * Use `getStatus(map, code)` for safe lookups when the backend may emit a
 * status the frontend doesn't know about yet.
 */
export interface StatusInfo {
  label: string
  variant: BadgeVariant
}

export type StatusMap = Record<string, StatusInfo>

/** Returns the entry if known, otherwise a gray badge with the raw code. */
export function getStatus(map: StatusMap, code: string | null | undefined): StatusInfo {
  if (code && map[code]) return map[code]
  return { label: code ?? '—', variant: 'gray' }
}

// ─── Invoice statuses ────────────────────────────────────────────────────────
export const invoiceStatusMap: StatusMap = {
  completed: { label: 'مكتملة', variant: 'success' },
  pending: { label: 'معلقة', variant: 'warning' },
  cancelled: { label: 'ملغاة', variant: 'danger' },
  returned: { label: 'مرتجعة', variant: 'gray' },
}

// ─── Purchase order statuses ─────────────────────────────────────────────────
// Backend writes 'pending' (not 'pending_approval'); kept the latter as an
// alias just in case older audit rows linger.
export const purchaseOrderStatusMap: StatusMap = {
  draft: { label: 'مسودة', variant: 'gray' },
  pending: { label: 'انتظار موافقة', variant: 'warning' },
  pending_approval: { label: 'انتظار موافقة', variant: 'warning' },
  approved: { label: 'موافق', variant: 'success' },
  partially_received: { label: 'مستلم جزئياً', variant: 'warning' },
  received: { label: 'مستلم', variant: 'info' },
  cancelled: { label: 'ملغي', variant: 'danger' },
}

// ─── Installment contract statuses ───────────────────────────────────────────
export const installmentStatusMap: StatusMap = {
  pending_approval: { label: 'انتظار موافقة', variant: 'warning' },
  active: { label: 'نشط', variant: 'success' },
  overdue: { label: 'متأخر', variant: 'danger' },
  completed: { label: 'مكتمل', variant: 'info' },
  cancelled: { label: 'ملغي', variant: 'gray' },
}

// ─── Expense approval statuses ───────────────────────────────────────────────
export const expenseStatusMap: StatusMap = {
  pending: { label: 'انتظار', variant: 'warning' },
  approved: { label: 'موافق', variant: 'success' },
  rejected: { label: 'مرفوض', variant: 'danger' },
}

// ─── Stock-transfer statuses ─────────────────────────────────────────────────
export const transferStatusMap: StatusMap = {
  pending: { label: 'انتظار', variant: 'warning' },
  completed: { label: 'مكتمل', variant: 'success' },
  rejected: { label: 'مرفوض', variant: 'danger' },
}

// ─── ETA submission statuses ─────────────────────────────────────────────────
export const etaStatusMap: StatusMap = {
  pending: { label: 'معلق', variant: 'warning' },
  failed: { label: 'فشل', variant: 'danger' },
  accepted: { label: 'مقبول', variant: 'success' },
  not_required: { label: 'غير مطلوب', variant: 'gray' },
}
