import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Force a single React instance. Without dedupe, lazy-loaded routes can
    // pull react-router-dom's own optimized React copy, producing the dreaded
    // "Cannot read properties of null (reading 'useRef')" crash in dev.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Pre-bundle the core deps at startup so their optimize hash is stable and
  // shared across eager and lazy chunks (avoids a second React instance being
  // introduced when a lazy route is first visited).
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
