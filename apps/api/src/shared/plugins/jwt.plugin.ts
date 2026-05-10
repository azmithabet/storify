import fp from 'fastify-plugin'
import jwtPlugin from '@fastify/jwt'
import type { FastifyInstance } from 'fastify'
import { config } from '../../config/env'

export default fp(async function (app: FastifyInstance) {
  await app.register(jwtPlugin, {
    secret: config.JWT_ACCESS_SECRET,
    sign: { expiresIn: config.JWT_ACCESS_EXPIRES_IN },
  })
})
