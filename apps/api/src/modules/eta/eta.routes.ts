import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requirePermission } from '@/shared/middleware/auth.middleware'
import { enqueueEtaSubmission } from '@/jobs/eta-submission.job'

const resubmitSchema = z.object({ invoiceId: z.string() })

export async function etaRoutes(app: FastifyInstance) {
  app.post(
    '/admin/eta/resubmit/:invoiceId',
    { preHandler: [authenticate, requirePermission('eta', 'manage')] },
    async (request, reply) => {
      const { invoiceId } = resubmitSchema.parse(request.params)
      const tenant = request.tenant!

      const rows = await request.tenantDb.$queryRawUnsafe<Array<{ id: string; eta_status: string }>>(
        `SELECT id, eta_status FROM invoices WHERE id = $1 LIMIT 1`,
        invoiceId,
      )

      if (!rows.length) return reply.code(404).send({ message: 'invoice_not_found' })
      if (rows[0].eta_status === 'accepted') {
        return reply.code(400).send({ message: 'invoice_already_accepted' })
      }

      await request.tenantDb.$executeRawUnsafe(
        `UPDATE invoices SET eta_status = 'pending', eta_error = NULL WHERE id = $1`,
        invoiceId,
      )

      await enqueueEtaSubmission({
        invoiceId,
        tenantId: tenant.id,
        schemaName: tenant.schemaName,
      })

      return reply.code(202).send({ message: 'resubmission_queued' })
    },
  )

  app.get(
    '/invoices/:invoiceId/eta-submissions',
    { preHandler: [authenticate, requirePermission('invoices', 'read')] },
    async (request, reply) => {
      const { invoiceId } = z.object({ invoiceId: z.string() }).parse(request.params)

      const rows = await request.tenantDb.$queryRawUnsafe(
        `SELECT id, attempt_number, status, submission_id, eta_uuid, error_message, created_at
         FROM eta_submissions WHERE invoice_id = $1 ORDER BY created_at DESC`,
        invoiceId,
      )

      return reply.send(rows)
    },
  )
}
