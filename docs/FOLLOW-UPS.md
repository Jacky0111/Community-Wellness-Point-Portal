# Follow-ups before production use

Phase 1 is complete and reviewed. This file records what was deliberately left
undone, and what must be closed before real client health data is stored.

Nothing here is a bug in the delivered scope — each item was either an explicit
owner decision or a finding triaged during the final whole-branch review.

## Must fix before real client data

**TOTP secrets are stored unencrypted.**
`BrandPartner.totpSecretEnc` holds the raw base32 secret despite the `Enc`
suffix. A read-only database leak or a stray backup hands an attacker a working
second factor for every account, permanently. Encrypt with an application key,
or rename the column so the next reader is not misled about what protects it.

**No rate limiting on login or MFA verification.**
A 6-digit TOTP is one million guesses with no lockout, and password attempts are
unthrottled too. This is the item most likely to actually be exploited on an
internet-reachable deployment. Add at least a per-IP and per-account attempt cap.

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

**Database migrations.** The project deliberately uses `prisma db push` with no
`prisma/migrations/` directory. This means the first production deploy needs a
manual `db push`, and every later schema change is an unrecorded, un-rollbackable
push. Fine for a small internal tool; worth revisiting before real data exists.

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
3. Set `SESSION_SECRET` in Vercel to 32+ random characters.
4. Run `npx prisma db push` then `npx prisma db seed` once against the Supabase
   database. Without this the app deploys but every query fails — no tables exist.
5. Log in as the seeded owner and **change the password immediately**.

Note that `prisma/seed.ts` uses `update: {}` in its upserts, so re-running the seed
will not repair a modified or deactivated owner account.
