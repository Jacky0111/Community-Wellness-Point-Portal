import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    env: {
      SESSION_SECRET: 'test-secret-32-character-minimum-length',
      ENCRYPTION_KEY: '1f2a38445e69b87605d173b661b1ab33e7dc72d8a39d3faae0e8290e2052d4c8',
    },
  },
})
