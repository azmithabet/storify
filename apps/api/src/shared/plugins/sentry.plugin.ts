import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

/**
 * Sentry error tracking plugin for Fastify.
 * Install: pnpm add @sentry/node in apps/api
 * Set SENTRY_DSN env var to activate.
 */
async function sentryPlugin(app: FastifyInstance) {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  try {
    const Sentry = await import('@sentry/node')
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [],
    })

    app.addHook('onError', async (request, _reply, error) => {
      Sentry.captureException(error, {
        extra: {
          url: request.url,
          method: request.method,
          tenantId: (request as { tenant?: { id?: string } }).tenant?.id,
        },
      })
    })

    app.log.info('[Sentry] Error tracking active')
  } catch {
    app.log.warn('[Sentry] @sentry/node not installed — skipping error tracking')
  }
}

export default fp(sentryPlugin, { name: 'sentry' })
