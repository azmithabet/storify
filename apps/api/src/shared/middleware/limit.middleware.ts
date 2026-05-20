import type { FastifyRequest, FastifyReply } from 'fastify'

/**
 * Server-side enforcement that a tenant hasn't exhausted their plan quota
 * before creating another resource.
 *
 * Why this exists separately from requireFeature():
 *   - requireFeature() gates *capability* (does the plan include suppliers?).
 *   - requireUnderLimit() gates *quantity* (is there headroom for one more?).
 *
 * Why count on every request rather than caching:
 *   The decision is sensitive (creating one extra row is a hard error if we
 *   miss). 30s cache staleness on requireFeature is acceptable because plans
 *   change rarely; row counts change every write, so caching them would
 *   either be wrong or invalidate immediately on each create.
 *
 * Limits with value 0 are treated as "unlimited" to preserve back-compat
 * with the existing seed where some plans intentionally have no cap. If you
 * want a true zero-quota tier, model that with requireFeature() instead.
 */
export type LimitResource = 'products' | 'users' | 'invoices' | 'branches'

export function requireUnderLimit(resource: LimitResource) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const plan = request.tenant?.plan
    if (!plan) return // tenant middleware should have rejected — fail open here, it'll catch downstream

    let limit: number
    let used: number
    let messageRes: string

    switch (resource) {
      case 'products':
        limit = plan.maxProducts
        if (limit <= 0) return // 0 = no cap (back-compat)
        used = await request.tenantDb.product.count()
        messageRes = 'منتج'
        break
      case 'users':
        limit = plan.maxUsers
        if (limit <= 0) return
        used = await request.tenantDb.user.count()
        messageRes = 'مستخدم'
        break
      case 'invoices':
        // maxOrders is the per-month invoice cap. Counting all-time would
        // permanently block tenants on long-lived plans; instead we scope to
        // the current calendar month to match the /me/usage display.
        limit = plan.maxOrders
        if (limit <= 0) return
        {
          const monthStart = new Date()
          monthStart.setDate(1)
          monthStart.setHours(0, 0, 0, 0)
          used = await request.tenantDb.invoice.count({ where: { createdAt: { gte: monthStart } } })
        }
        messageRes = 'فاتورة'
        break
      case 'branches': {
        // max_branches lives in the features JSON, not as a column. The Admin UI
        // uses -1 to mean "unlimited" (Enterprise); 0 also means no cap to stay
        // consistent with the back-compat rule used by the column-based cases.
        const features = plan.features as Record<string, unknown> | null
        const raw = features?.max_branches
        limit = typeof raw === 'number' ? raw : 0
        if (limit <= 0) return
        used = await request.tenantDb.branch.count()
        messageRes = 'فرع'
        break
      }
    }

    if (used >= limit) {
      return reply.status(402).send({
        success: false,
        error: {
          code: 'plan_limit_reached',
          message: `وصلت للحد الأقصى (${limit} ${messageRes}) في باقتك الحالية. ترقّى لباقة أعلى لإضافة المزيد.`,
          resource,
          used,
          limit,
        },
      })
    }
  }
}
