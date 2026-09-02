# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in
this repository.

## Project

Community Wellness Point — an internal tool for recording basic health assessments
(blood pressure, body composition, blood glucose) for clients, browsing/filtering
stored results, and referencing normal measurement ranges. A Skin Analysis module is
planned for phase 2 and currently exists only as a disabled "Coming Soon" nav item.

Full design rationale lives in
[docs/superpowers/specs/2026-09-03-community-wellness-point-design.md](docs/superpowers/specs/2026-09-03-community-wellness-point-design.md).
Read it before making architectural changes.

## Commands

Not yet implemented — this file will be updated with `npm run dev`/`build`/`test`/etc.
once the project is scaffolded (Next.js + TypeScript + Prisma).

## Architecture

Next.js (App Router), TypeScript, Ant Design, Prisma + PostgreSQL (Supabase), single
full-stack codebase deployable to Vercel. Architecture closely follows the sibling
project `Bluestorm-Web-App` (multi-step auth state machine, iron-session + bcrypt +
TOTP MFA, Prisma singleton with an explicit driver adapter, Zod validation re-run
server-side) but with:

- **`BrandPartner`** instead of `Staff` as the account/entity name, everywhere (model,
  fields, UI copy) — this is a deliberate terminology choice, not a placeholder.
- **Admin-defined roles**, not hardcoded staff/admin levels. `Role.permissions` is a
  JSON bag of booleans (`viewAllAssessments`, `manageRoles`, `managePartners`,
  `exportData`, `deleteRecords`) editable via a CRUD UI under Settings, not fixed
  columns — so new permissions can be added without a schema migration. One seeded
  `isSystemDefault` role always has every permission and can't be deleted, to prevent
  a full lockout.
- **No referrer/activity field.** Bluestorm's public-wizard "who referred you" step is
  intentionally dropped — `Assessment.handledByPartnerId` is set from the logged-in
  session, not a form field.
- **Ant Design**, not Tailwind — chosen specifically for its built-in `Sider`/`Layout`
  (side panel navigation) and `Table` filtering, to minimize custom component work for
  an admin-dashboard-shaped app.

**Results visibility is enforced server-side, not just hidden in the UI.** Every query
for `Assessment` rows must filter to `handledByPartnerId = currentPartner.id` unless the
partner's role has `viewAllAssessments`. Never rely on the client to withhold rows it
shouldn't see.

**The Measurement page is static content, not a data view.** It lists normal
measurement ranges (e.g. BP < 120/80 mmHg, visceral fat ≤ 5) as hardcoded page content.
Don't confuse it with a per-client measurement history — that's not what "Measurement"
means in this app's nav (see spec's "Data flow" clarification).

**Skin Analysis has no backend.** The nav item is disabled/greyed out with a
"Coming Soon" indicator and no route. Do not scaffold a route, schema, or API for it
until phase 2 is explicitly brainstormed.

**PDF report generation is deferred.** The Result page's per-record "Download PDF"
action should render as disabled with a tooltip, not a real feature, until that pipeline
is designed separately. Bulk Excel export of filtered Results *is* in scope for phase 1.

## Gotchas carried over from Bluestorm (verify still applicable once scaffolded)

- Prisma 7+ requires an explicit driver adapter — `new PrismaClient()` with no adapter
  throws at runtime. Always import a singleton client, never instantiate elsewhere.
- Next.js's env loader expands `$` in `.env` values as variable references — escape any
  literal `$` in secrets (e.g. a DB password) as `\$`. Doesn't apply to Vercel's
  dashboard env vars, only to `.env` files.
- Use Supabase's Supavisor pooler (`:6543`, `?pgbouncer=true`) for production
  `DATABASE_URL` — the direct connection (`:5432`) exhausts Postgres connections under
  serverless/concurrent load.
- Don't import password-hashing code (bcrypt) into anything on the Edge middleware's
  import graph — bcryptjs needs Node APIs unavailable in a real Edge runtime.
- **CWP-specific, not from Bluestorm:** `antd@5.x` requires `@ant-design/cssinjs@^1.x`
  internally, but `@ant-design/nextjs-registry@1.3.0+` was built and tested against
  `antd@^6.0.0` / `@ant-design/cssinjs@^2.x`. If both end up resolving to different
  major versions of `@ant-design/cssinjs` (check with `npm ls @ant-design/cssinjs` —
  it should show one deduped version, not a nested copy under `antd/node_modules`),
  `AntdRegistry`'s SSR style extraction silently breaks: every component still gets
  its correct `ant-*`/`css-dev-only-do-not-override-*` classes, but **zero `<style>`
  tags are ever injected**, so the whole app renders with plain unstyled browser
  defaults instead of Ant Design's (or a custom `ConfigProvider` theme's) styling —
  with no error, warning, or console output anywhere. That silent, classes-present-
  but-nothing-styled symptom is the fast way to recognize this specific bug over any
  other "my AntD styling isn't showing up" cause. Fix: keep
  `@ant-design/nextjs-registry` pinned to `^1.2.0` (the last release actually built
  against `antd@^5.12.5` / `@ant-design/cssinjs@^1.24.0` — this project's stack), not
  `^1.3.0`+, until upgrading to `antd` v6.
