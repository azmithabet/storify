import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    // Mirror tsconfig.json paths so `@/foo` imports resolve in tests.
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Each test file gets its own process so a module that loads `config`
    // doesn't poison the env for other tests.
    isolate: true,
  },
})
