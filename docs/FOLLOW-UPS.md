# Follow-ups before production use

Phase 1 is complete and reviewed. This file records what was deliberately left
undone, and what must be closed before real client health data is stored.

Nothing here is a bug in the delivered scope — each item was either an explicit
owner decision or a finding triaged during the final whole-branch review.

## Completed

**TOTP secrets are now encrypted at rest.** `BrandPartner.totpSecretEnc` is
AES-256-GCM encrypted via `src/lib/crypto.ts` (`ENCRYPTION_KEY`, random IV per
value, `v1:` self-describing format). Legacy plaintext values from before this
change are detected and lazily re-encrypted on next successful login;
`scripts/encrypt-totp-secrets.ts` bulk-migrates any that are never logged in
with.

**Login and MFA verification are now rate limited.** Both routes lock an
account for 15 minutes after 5 failed attempts (`src/lib/rateLimit.ts`,
DB-backed via new `BrandPartner` counter/lockedUntil columns so it works across
serverless instances). Returns 429 while locked; a correct TOTP code submitted
during a lockout still does not promote the session.

**Database migrations now use Prisma Migrate, not `prisma db push`.** An
`0_init` migration captures the schema as it existed under `db push` (all
columns and indexes added so far, including the rate-limit fields and the
soft-delete columns), baselined as already-applied against the existing local
dev and test databases — it was never executed against them. From here,
schema changes go through `npx prisma migrate dev` locally, and migrations are
applied to production **manually** via `npx prisma migrate deploy` run with
`DATABASE_URL` pointed at the **session pooler (port `5432`)**, before the code
that depends on them ships — never automatically from the Vercel build, and
never over the transaction pooler (port `6543`), which cannot run migrations
(see the deployment checklist below). `prisma db push` should no longer be run
against any database that has migrations applied — it bypasses the migration
history and risks drifting it out of sync.

## Must fix before real client data

_(nothing currently — see Completed above)_

## Should fix soon

**No automated tests for any API route.**
The 42 unit tests cover pure logic only. Every security property — row scoping,
permission gates, the pending-vs-authenticated session boundary — rests on manual
verification performed during development. The one Critical found in final review
(a deactivated partner keeping a live session) is exactly what a route-level test
suite would have caught. Highest-leverage item on this list.

**TOTP secret round-trips through the client during enrollment.**
`GET /api/auth/mfa/enroll` returns the secret and the subsequent `POST` accepts it
back, rather than holding it server-side in the pending session. Bounded — it only
applies during first enrollment, and an attacker would already need the password —
but the fix is short.

**Roles can strip their own administrative permissions.**
`PATCH /api/partners/[id]` now refuses to let a partner demote or deactivate
themselves. But a non-system admin *role* can still have `manageRoles` removed from
it via `PATCH /api/roles/[id]`. The `isSystemDefault` guard protects only the seeded
Owner role. Recovery from a full lockout is direct SQL.

## Decisions needed from the project owner

**The `deleteRecords` permission does nothing.** It is grantable and labelled
"Delete records" in the Settings UI, but no delete endpoint exists for
`Assessment`. Either implement deletion behind it, or remove the permission —
as it stands an administrator can grant a capability that silently has no effect.

## Accepted as-is

- **Login timing side-channel.** Bcrypt runs only when an account exists and is
  active, so response latency distinguishes registered emails. Status codes and
  bodies are identical. Low value in an internal tool with a known partner list.
- **UTC week/month boundaries on the dashboard.** Counts use UTC rather than
  clinic-local time, so records created near midnight can fall in the adjacent
  period. Deterministic and correct; revisit only if the counts drive decisions.
- **Two Ant Design console warnings.** A `destroyOnClose` deprecation and a benign
  `useForm` timing warning. Root-caused, no functional impact.
- **Dashboard counts load all scoped rows** to compute three numbers. Fine at
  current volume; replace with `count()` queries before tens of thousands of rows.

## Deployment checklist

1. Create the Supabase project.
2. Set `DATABASE_URL` in Vercel to the **Supavisor pooler on port `:6543`**, not
   the direct `:5432` connection, which exhausts Postgres connections under
   serverless load. (Note: `?pgbouncer=true` is a Prisma-query-engine flag and is
   ignored under Prisma 7 with `@prisma/adapter-pg` — the port is what matters.)
3. Set `SESSION_SECRET` (32+ random characters) **and** `ENCRYPTION_KEY` (64
   hex characters / 32 bytes — generate with `openssl rand -hex 32`) in
   Vercel. **Both must be set before the first deploy, not after:**
   `src/lib/crypto.ts` throws at module load if `ENCRYPTION_KEY` is missing
   or malformed, which is on the import graph of both MFA routes — since MFA
   is mandatory, that fails every login closed for every existing user, not
   just new enrollments.
4. Before the first deploy, apply migrations against Supabase manually:
   `DATABASE_URL=<session pooler, port 5432> npx prisma migrate deploy`, then
   `npx prisma db seed` once with the same `DATABASE_URL`. **Do not** point
   `migrate deploy` at the port `:6543` transaction pooler used by Vercel's
   runtime `DATABASE_URL` — the transaction pooler cannot run migrations; a
   `db push` attempted over it hung indefinitely during development, and
   `migrate deploy` would be expected to do the same. Without this step the
   app deploys but every query fails — no tables exist.
5. For every later schema change: run `npx prisma migrate dev --name
   <description>` locally to create and apply the migration against your local
   database, commit the new `prisma/migrations/` folder, then before the
   dependent code ships, run `npx prisma migrate deploy` by hand against the
   Supabase session pooler (port `5432`) as in step 4. Migrations are **not**
   applied automatically by the Vercel build.
6. Log in as the seeded owner and **change the password immediately**.

Note that `prisma/seed.ts` uses `update: {}` in its upserts, so re-running the seed
will not repair a modified or deactivated owner account.
