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
      DATABASE_URL: 'postgresql://jackychung@localhost:5432/community_wellness_point_test',
    },
    setupFiles: ['./src/test/setup.ts'],
    // These integration tests share ONE real Postgres database and each
    // truncates all tables in beforeEach. Running test files concurrently
    // (vitest's default) lets one file's truncate wipe rows another file's
    // test just created, causing spurious FK-violation failures that have
    // nothing to do with the code under test. Force fully sequential
    // execution so tests are isolated by ordering instead of by luck.
    fileParallelism: false,
  },
})
