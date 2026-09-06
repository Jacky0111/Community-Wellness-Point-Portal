// Vitest global setup for API route integration tests.
//
// Hard safety guard: these tests run real Prisma queries against a real
// Postgres database (we deliberately do NOT mock Prisma — see src/test/db.ts).
// If DATABASE_URL is ever misconfigured to point at the dev or production
// database, a test run truncating tables between tests would destroy real
// data. This throws immediately, before any test runs, unless the resolved
// DATABASE_URL unambiguously points at a "_test" database.
const databaseUrl = process.env.DATABASE_URL ?? ''

if (!databaseUrl.endsWith('_test') && !/_test(\?.*)?$/.test(databaseUrl)) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL does not point at a "_test" database ` +
      `(got: ${databaseUrl || '<unset>'}). Tests truncate tables between runs and must ` +
      `never run against a dev or production database.`
  )
}
