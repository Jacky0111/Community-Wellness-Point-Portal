# Community Wellness Point — Design Spec

Date: 2026-09-03
Status: Approved for planning

## Purpose

An internal tool for Community Wellness Point staff ("Brand Partners") to record basic
health assessments for clients (blood pressure, body composition, blood glucose, etc.),
store and review the results, and reference normal measurement ranges. A future Skin
Analysis module is scoped out to phase 2 and appears only as a disabled "Coming Soon"
nav item for now.

This app takes cues from an existing sibling project, Bluestorm-Web-App (Next.js +
Prisma + Supabase Postgres + iron-session auth), reusing its architecture patterns and
its health-assessment field set, but with its own visual design (not Tailwind/Bluestorm's
styling) and its own permission model.

## Goals

- Record health assessments through a multi-page form.
- Store and browse results with filtering, per-record detail, and bulk export.
- Show a static reference page of normal measurement ranges.
- Support fully custom, admin-defined roles and permissions (no hardcoded "staff/admin").
- Work well on mobile, tablet, and desktop.
- Reserve a "Skin Analysis" section for phase 2, visibly present but disabled.

## Non-goals (phase 1)

- Skin Analysis feature itself (schema, form, results) — phase 2.
- PDF generation for per-record reports — deferred; a disabled button placeholder only.
  The bulk Excel export is in scope for phase 1.
- Public-facing / unauthenticated submission flow — this is an internal tool only.
- Editable reference ranges via UI — the Measurement page's normal ranges are hardcoded
  content for phase 1.

## Tech Stack

- **Framework**: Next.js (App Router), TypeScript
- **UI library**: Ant Design (`Layout`/`Sider` for the side panel, `Table`, `Form`, `Steps`)
- **ORM / DB**: Prisma + Supabase Postgres (Supavisor pooler in production, direct
  connection for local dev — see Bluestorm's `CLAUDE.md` for the exact gotcha)
- **Auth**: iron-session cookies + bcrypt password hashing + TOTP MFA (otplib), same
  pattern as Bluestorm, adapted to the `BrandPartner` model
- **Validation**: Zod, re-validated server-side on every mutation
- **Bulk export**: `exceljs` (or equivalent) for Results → Excel
- **Testing**: Vitest for pure logic (schemas, permission checks, BMI calculation)
- **Deployment**: Vercel

Single full-stack codebase, no separate backend service — mirrors Bluestorm's
architecture, which is proven for this vendor combination (Vercel + Supabase).

## Navigation (Side Panel)

Ant Design `Sider`, collapsible on desktop, becomes a drawer on mobile/tablet widths.
Menu items are filtered by the logged-in Brand Partner's role permissions.

```
📊 Dashboard
🩺 Health Assessment
   ├─ Form          (multi-page intake)
   ├─ Result        (table, filter, download)
   └─ Measurement   (static reference ranges)
🧴 Skin Analysis  — disabled, "Coming Soon" badge/tooltip, no route
⚙️  Settings
   ├─ My Profile
   └─ Brand Partners & Roles  (CRUD, permission-gated)
```

## Data Model

```prisma
model Role {
  id              String   @id @default(cuid())
  name            String   @unique          // admin-editable display name, e.g. "Wellness Champion"
  permissions     Json     // { viewAllAssessments, manageRoles, managePartners, exportData, deleteRecords }
  isSystemDefault Boolean  @default(false)  // seeded "Owner" role — always full permissions, cannot be deleted
  createdAt       DateTime @default(now())
  updatedAt       DateTime @default(now()) @updatedAt

  partners        BrandPartner[]
}

model BrandPartner {
  id                 String    @id @default(cuid())
  email              String    @unique
  name               String
  passwordHash       String
  mustChangePassword Boolean   @default(true)
  totpSecretEnc      String?
  totpEnabledAt      DateTime?
  isActive           Boolean   @default(true)
  roleId             String
  role               Role      @relation(fields: [roleId], references: [id])
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @default(now()) @updatedAt

  assessments        Assessment[] @relation("HandledByPartner")
}

model Assessment {
  id                  String       @id @default(cuid())
  email               String?
  date                DateTime
  name                String
  contactNumber       String
  age                 Int?
  height              Float?
  weight              Float?
  bodyFatPercent      Float?
  visceralFatLevel    Float?
  bmi                 Float?
  restingMetabolism   Float?
  bodyAge             Int?
  systolicBp          Int?
  diastolicBp         Int?
  bloodGlucose        Float?
  remarks             String?
  handledByPartnerId  String
  handledByPartner    BrandPartner @relation("HandledByPartner", fields: [handledByPartnerId], references: [id])
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @default(now()) @updatedAt

  @@index([name])
  @@index([contactNumber])
  @@index([date])
  @@index([handledByPartnerId])
}
```

Notes:
- `handledByPartnerId` is set automatically from the logged-in session — there is no
  manual "referrer" field (Bluestorm's referrer/activity step is intentionally dropped).
- `Role.permissions` is a JSON bag of booleans rather than fixed schema columns, so new
  permissions can be added later without a migration. Known keys for phase 1:
  `viewAllAssessments`, `manageRoles`, `managePartners`, `exportData`, `deleteRecords`.
- One seeded system role (`isSystemDefault: true`, e.g. "Owner") always has every
  permission and can never be deleted or edited away, so the app can't be locked out of
  its own admin.
- Results visibility is enforced **server-side**: any query for Assessment rows filters
  to `handledByPartnerId = currentPartner.id` unless the partner's role has
  `viewAllAssessments`.

## Pages

### Dashboard

Funnel drill-down layout:
1. Summary stat cards at the top: Total Assessments, This Week, This Month — scoped to
   what the logged-in partner is permitted to see.
2. Recent Activity list below: last ~10 assessments (name, date, handled by), each row
   links into that record's Result detail view.
3. A prominent "New Health Assessment" call-to-action that jumps straight into the Form.

### Health Assessment → Form

Multi-page wizard (Ant Design `Steps` + `Form`), Zod-validated server-side on submit.
Ported from Bluestorm's field set, with the referrer/activity step removed entirely:

1. **Personal Info**: email, date, name, contact number, age, height
2. **Body Composition**: weight, body fat %, visceral fat level, resting metabolism,
   BMI (auto-calculated from height/weight, editable), body age
3. **Blood Pressure**: systolic, diastolic
4. **Blood Glucose**
5. **Notes**: remarks

### Health Assessment → Result

Ant Design `Table`:
- **Filters**: date range, name/contact search, brand partner (only shown/usable if the
  viewer has `viewAllAssessments`; otherwise implicitly scoped to their own records)
- **Row actions**: view detail; per-record "Download PDF" button present but disabled
  with a "coming soon" tooltip (PDF pipeline to be brainstormed separately)
- **Bulk action**: select rows → export to Excel

### Health Assessment → Measurement

Static content page, no data fetching — lists normal ranges for each measurement type
(e.g. Blood Pressure: normal < 120/80 mmHg; Visceral Fat Level: normal ≤ 5). Content is
hardcoded in phase 1; editing via Settings is a possible phase 2 addition, not built now.

### Skin Analysis

Nav item visible but disabled/greyed out with a "Coming Soon" badge or tooltip. No route,
no schema, no data model — pure placeholder for phase 1.

### Settings

- **My Profile**: change password, MFA enroll/manage (mirrors Bluestorm's flow)
- **Brand Partners & Roles**: CRUD UI for
  - Roles: create/edit/delete (except the system default), name (free text), and
    permission checkboxes
  - Brand Partners: invite/create, edit, deactivate, assign a role
  - Gated by `manageRoles` / `managePartners` permissions respectively

## Auth Flow

Same multi-step state machine as Bluestorm, adapted to `BrandPartner`:
1. `/api/auth/login` verifies password, opens a short-lived pending session.
2. If `mustChangePassword`, force `/login/change-password`.
3. If no `totpEnabledAt`, force MFA enrollment; otherwise require MFA verification.
4. Only after both steps does the pending session get promoted to a real session.

`middleware.ts` gates the entire app except `/login*` and `/api/auth/*`. Route handlers
still call an authorization helper (analogous to Bluestorm's `authz.ts`) to check the
current partner's role permissions before executing an action — the middleware only
proves "logged in", not "allowed to do X".

## Responsive Design (mobile/tablet/desktop)

- `Sider` collapses to an off-canvas drawer under Ant Design's `md` breakpoint.
- `Table` (Results) switches to a horizontally-scrollable or card-based layout on narrow
  screens.
- The multi-step Form stacks fields vertically at narrow widths (Ant Design `Form`
  `labelCol`/`wrapperCol` responsive props, or a vertical layout below `md`).
- Verified manually at three breakpoints: mobile (375px), tablet (768px), desktop
  (1280px+).

## Deployment

- Vercel, Next.js native deployment.
- Supabase Postgres: direct connection (`:5432`) for local dev, Supavisor pooler
  (`:6543`, `?pgbouncer=true`) for production `DATABASE_URL` to avoid exhausting
  connections under serverless concurrency (same gotcha documented in Bluestorm's
  `CLAUDE.md`).

## Testing Strategy

- Vitest for pure logic: Zod schemas, BMI calculation, permission-check helpers
  (does role X see record Y).
- No E2E/component suite for phase 1 — Form and Results are verified manually via the
  dev server, consistent with Bluestorm's approach.

## Open Questions / Phase 2 Candidates

- PDF report generation pipeline for per-record downloads (explicitly deferred by the
  user — to be brainstormed separately).
- Skin Analysis feature: form fields, data model, whether it reuses the client concept
  from Health Assessment or is fully independent.
- Whether Measurement reference ranges should become admin-editable later.
