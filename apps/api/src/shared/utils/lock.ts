import { redis } from '@/config/redis'

/**
 * Best-effort distributed mutex for scheduled jobs. Returns true if the
 * caller acquired the lock for `ttlMs` and false if another instance already
 * holds it. The TTL is a safety net — if a worker crashes, the lock auto-
 * expires so the next scheduled tick can still run. Pick a TTL that's
 * comfortably longer than the worst-case job duration but shorter than the
 * scheduled interval.
 */
export async function withLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const lockKey = `lock:${key}`
  const acquired = await redis.set(lockKey, '1', 'PX', ttlMs, 'NX')
  if (acquired !== 'OK') return null
  try {
    return await fn()
  } finally {
    await redis.del(lockKey).catch(() => {})
  }
}
