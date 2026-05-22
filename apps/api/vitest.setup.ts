// Vitest global setup — runs once before any test file, in each worker.
//
// `src/config/env.ts` parses process.env via zod and calls `process.exit(1)`
// on validation failure. That means importing *anything* that transitively
// pulls in `config` (which is almost every file) requires these env vars to
// be set first. We populate sensible test defaults here so individual test
// files don't have to reach into env at all.
process.env.NODE_ENV = 'test'
process.env.FRONTEND_URL = 'http://localhost:5173'
process.env.DATABASE_MASTER_URL = 'postgresql://test:test@localhost:5432/test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-at-least-32-chars-long'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-at-least-32-chars-long'

// AES-256-GCM key: 32 bytes (64 hex chars). Required by encryption tests;
// harmless when set for other tests.
process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

// Paymob HMAC secret — required by webhook verification tests.
process.env.PAYMOB_HMAC_SECRET = 'test-paymob-hmac-secret'
