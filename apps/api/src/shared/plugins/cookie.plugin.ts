import fp from 'fastify-plugin'
import cookiePlugin from '@fastify/cookie'
import type { FastifyInstance } from 'fastify'

export default fp(async function (app: FastifyInstance) {
  await app.register(cookiePlugin)
})
