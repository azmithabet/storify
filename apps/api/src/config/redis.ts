import IORedis from 'ioredis'
import { config } from './env'

export const redis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // required for BullMQ workers
  lazyConnect: true,
})
