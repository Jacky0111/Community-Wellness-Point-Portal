# Community Wellness Point MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the phase-1 Community Wellness Point app: authenticated Brand Partners record Health Assessments through a multi-step form, browse/filter/export results, view a static measurement-range reference, and manage admin-defined roles/permissions and partner accounts — all behind a responsive side-panel layout, with Skin Analysis present only as a disabled "Coming Soon" nav item.

**Architecture:** Single Next.js (App Router, TypeScript) full-stack codebase, Prisma + Supabase Postgres, Ant Design for UI (`Sider`/`Layout`, `Table`, `Form`, `Steps`), iron-session + bcrypt + TOTP for auth, Zod for server-side validation, deployed to Vercel. Mirrors the sibling project Bluestorm-Web-App's architecture patterns.

**Tech Stack:** Next.js 14 (App Router) · TypeScript · Ant Design 5 · Prisma 7 (`@prisma/adapter-pg`) · Supabase Postgres · iron-session · bcryptjs · otplib · Zod · exceljs · Vitest

## Global Constraints

- Full design rationale: [docs/superpowers/specs/2026-09-03-community-wellness-point-design.md](../specs/2026-09-03-community-wellness-point-design.md) — consult it for anything not covered by a task below.
- Entity naming is **BrandPartner**, never "Staff" — in Prisma models, TypeScript types, API routes, and all UI copy.
- Roles are **admin-defined**, not hardcoded levels: `Role.permissions` is a JSON bag of booleans (`viewAllAssessments`, `manageRoles`, `managePartners`, `exportData`, `deleteRecords`). One seeded role has `isSystemDefault: true`, always has every permission, and can never be edited or deleted.
- `Assessment.handledByPartnerId` is set automatically from the logged-in session on create — there is no manual referrer/activity field anywhere in the form.
- Results visibility is enforced **server-side**: every Assessment query filters to `handledByPartnerId = currentPartner.id` unless the caller's role has `viewAllAssessments`. Never rely on the client to withhold rows.
- The Measurement page is static hardcoded content, not a database-backed view.
- Skin Analysis has no route, schema, or API in this plan — nav item only, disabled with a "Coming Soon" indicator.
- Per-record PDF report download is out of scope — render the button disabled with a tooltip. Bulk Excel export of the (filtered) Results table is in scope.
- All server-side mutations re-validate with Zod — never trust client-side validation alone.
- Testing: Vitest for pure logic only (calculations, permission checks, query-builders, schemas). No E2E/component test suite — Form/Results/Settings pages are verified manually via `npm run dev` at three breakpoints (375px, 768px, 1280px+).
- Production `DATABASE_URL` must use Supabase's Supavisor pooler (`:6543`, `?pgbouncer=true`); local dev uses the direct connection (`:5432`).
- Never import `src/lib/password.ts` (bcrypt) into anything on the Edge middleware's import graph — `src/middleware.ts` and `src/lib/session.ts` must stay bcrypt-free.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.eslintrc.json`, `.gitignore`, `vitest.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `.env.example`

**Interfaces:**
- Produces: a runnable Next.js 14 + TypeScript + Ant Design app; `npm run dev`, `npm run build`, `npm test`, `npx tsc --noEmit` all work from this task forward.

- [ ] **Step 1: Scaffold the Next.js app**

```bash
npx create-next-app@14 . --typescript --eslint --app --src-dir --import-alias "@/*" --no-tailwind
```

Answer prompts to use the existing (empty-except-docs) directory.

- [ ] **Step 2: Install dependencies**

```bash
npm install antd @ant-design/icons @prisma/client @prisma/adapter-pg pg zod iron-session bcryptjs otplib exceljs
npm install -D prisma @types/pg @types/bcryptjs vitest @vitejs/plugin-react tsx dotenv
```

- [ ] **Step 3: Add `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Add test script to `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "postinstall": "prisma generate"
  }
}
```

- [ ] **Step 5: Wire Ant Design's registry into the root layout**

`src/app/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { AntdRegistry } from '@ant-design/nextjs-registry'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  )
}
```

```bash
npm install @ant-design/nextjs-registry
```

- [ ] **Step 6: Verify the app builds and runs**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors (the default `src/app/page.tsx` from scaffolding is fine as-is for now).

- [ ] **Step 7: Add `.env.example` placeholders**

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/community_wellness_point"
SESSION_SECRET="replace-with-a-32-char-minimum-random-string"
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TypeScript + Ant Design project"
```

---

### Task 2: Prisma schema, migration, and seed

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `prisma.seed` config)

**Interfaces:**
- Produces: `Role`, `BrandPartner`, `Assessment` Prisma models; a singleton `prisma` client exported from `src/lib/prisma.ts`; a seed script that creates the `Owner` system-default role and one initial `BrandPartner` account.

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Role {
  id              String   @id @default(cuid())
  name            String   @unique
  permissions     Json
  isSystemDefault Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @default(now()) @updatedAt

  partners BrandPartner[]
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

  assessments Assessment[] @relation("HandledByPartner")

  @@index([roleId])
}

model Assessment {
  id                 String       @id @default(cuid())
  email              String?
  date               DateTime
  name               String
  contactNumber      String
  age                Int?
  height             Float?
  weight             Float?
  bodyFatPercent     Float?
  visceralFatLevel   Float?
  bmi                Float?
  restingMetabolism  Float?
  bodyAge            Int?
  systolicBp         Int?
  diastolicBp        Int?
  bloodGlucose       Float?
  remarks            String?
  handledByPartnerId String
  handledByPartner   BrandPartner @relation("HandledByPartner", fields: [handledByPartnerId], references: [id])
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @default(now()) @updatedAt

  @@index([name])
  @@index([contactNumber])
  @@index([date])
  @@index([handledByPartnerId])
}
```

- [ ] **Step 2: Write the Prisma singleton with driver adapter**

`src/lib/prisma.ts`:

```ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

export const prisma = globalThis.__prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
```

- [ ] **Step 3: Write the seed script**

`prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  const ownerRole = await prisma.role.upsert({
    where: { name: 'Owner' },
    update: {},
    create: {
      name: 'Owner',
      isSystemDefault: true,
      permissions: {
        viewAllAssessments: true,
        manageRoles: true,
        managePartners: true,
        exportData: true,
        deleteRecords: true,
      },
    },
  })

  const passwordHash = await bcrypt.hash('ChangeMe123!', 12)

  await prisma.brandPartner.upsert({
    where: { email: 'owner@communitywellnesspoint.local' },
    update: {},
    create: {
      email: 'owner@communitywellnesspoint.local',
      name: 'Initial Owner',
      passwordHash,
      mustChangePassword: true,
      roleId: ownerRole.id,
    },
  })

  console.log('Seeded Owner role and initial BrandPartner (owner@communitywellnesspoint.local / ChangeMe123!)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

- [ ] **Step 4: Register the seed command**

`package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 5: Push the schema and seed a local database**

Run: `npx prisma db push && npx prisma db seed`
Expected: tables created, seed logs the confirmation message. (Requires a local/dev `DATABASE_URL` in `.env` — use a local Postgres or a Supabase dev project.)

- [ ] **Step 6: Commit**

```bash
git add prisma package.json src/lib/prisma.ts
git commit -m "feat: add Prisma schema, client singleton, and seed script"
```

---

### Task 3: BMI calculation utility (TDD)

**Files:**
- Create: `src/lib/bmi.ts`
- Test: `src/lib/bmi.test.ts`

**Interfaces:**
- Produces: `calculateBmi(heightCm: number | null | undefined, weightKg: number | null | undefined): number | null`

- [ ] **Step 1: Write the failing test**

`src/lib/bmi.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { calculateBmi } from './bmi'

describe('calculateBmi', () => {
  it('computes BMI from height (cm) and weight (kg)', () => {
    expect(calculateBmi(170, 70)).toBeCloseTo(24.2, 1)
  })

  it('returns null when height is missing', () => {
    expect(calculateBmi(null, 70)).toBeNull()
  })

  it('returns null when weight is missing', () => {
    expect(calculateBmi(170, undefined)).toBeNull()
  })

  it('returns null for non-positive values', () => {
    expect(calculateBmi(0, 70)).toBeNull()
    expect(calculateBmi(170, -5)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bmi.test.ts`
Expected: FAIL — `calculateBmi` is not defined / module not found.

- [ ] **Step 3: Implement `calculateBmi`**

`src/lib/bmi.ts`:

```ts
export function calculateBmi(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined
): number | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null
  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)
  return Math.round(bmi * 10) / 10
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bmi.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/bmi.ts src/lib/bmi.test.ts
git commit -m "feat: add BMI calculation utility"
```

---

### Task 4: Permission-check helper (TDD)

**Files:**
- Create: `src/lib/permissions.ts`
- Test: `src/lib/permissions.test.ts`

**Interfaces:**
- Produces: `PERMISSION_KEYS`, `type PermissionKey`, `type PermissionSet = Record<PermissionKey, boolean>`, `hasPermission(permissions: Partial<PermissionSet> | null | undefined, key: PermissionKey): boolean`

- [ ] **Step 1: Write the failing test**

`src/lib/permissions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hasPermission } from './permissions'

describe('hasPermission', () => {
  it('returns true when the permission is explicitly true', () => {
    expect(hasPermission({ viewAllAssessments: true }, 'viewAllAssessments')).toBe(true)
  })

  it('returns false when the permission is explicitly false', () => {
    expect(hasPermission({ viewAllAssessments: false }, 'viewAllAssessments')).toBe(false)
  })

  it('returns false when the permission key is missing', () => {
    expect(hasPermission({}, 'manageRoles')).toBe(false)
  })

  it('returns false when permissions is null or undefined', () => {
    expect(hasPermission(null, 'manageRoles')).toBe(false)
    expect(hasPermission(undefined, 'manageRoles')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/permissions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/permissions.ts`:

```ts
export const PERMISSION_KEYS = [
  'viewAllAssessments',
  'manageRoles',
  'managePartners',
  'exportData',
  'deleteRecords',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export type PermissionSet = Record<PermissionKey, boolean>

export function hasPermission(
  permissions: Partial<PermissionSet> | null | undefined,
  key: PermissionKey
): boolean {
  return permissions?.[key] === true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/permissions.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions.ts src/lib/permissions.test.ts
git commit -m "feat: add permission-check helper"
```

---

### Task 5: Password hashing helpers (TDD)

**Files:**
- Create: `src/lib/password.ts`
- Test: `src/lib/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>`
- **Note:** this module uses bcryptjs (Node-only APIs). Never import it from `src/middleware.ts` or `src/lib/session.ts`.

- [ ] **Step 1: Write the failing test**

`src/lib/password.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('hashes a password and verifies the correct plaintext against it', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true)
  })

  it('rejects an incorrect plaintext', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('produces a different hash each time (salted)', async () => {
    const hashA = await hashPassword('same-input')
    const hashB = await hashPassword('same-input')
    expect(hashA).not.toBe(hashB)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/password.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/password.ts`:

```ts
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/password.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/password.ts src/lib/password.test.ts
git commit -m "feat: add password hashing helpers"
```

---

### Task 6: Auth flow resolver (TDD)

**Files:**
- Create: `src/lib/authFlow.ts`
- Test: `src/lib/authFlow.test.ts`

**Interfaces:**
- Produces: `type LoginStep = 'change-password' | 'mfa-enroll' | 'mfa-verify'`, `interface PartnerLoginState { mustChangePassword: boolean; totpEnabledAt: Date | null }`, `resolveNextLoginStep(partner: PartnerLoginState): LoginStep`

- [ ] **Step 1: Write the failing test**

`src/lib/authFlow.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { resolveNextLoginStep } from './authFlow'

describe('resolveNextLoginStep', () => {
  it('requires a password change first if mustChangePassword is true', () => {
    expect(resolveNextLoginStep({ mustChangePassword: true, totpEnabledAt: null })).toBe('change-password')
  })

  it('requires MFA enrollment when password is set but TOTP is not enabled', () => {
    expect(resolveNextLoginStep({ mustChangePassword: false, totpEnabledAt: null })).toBe('mfa-enroll')
  })

  it('requires MFA verification when both password and TOTP are set up', () => {
    expect(
      resolveNextLoginStep({ mustChangePassword: false, totpEnabledAt: new Date() })
    ).toBe('mfa-verify')
  })

  it('prioritizes password change over MFA state', () => {
    expect(
      resolveNextLoginStep({ mustChangePassword: true, totpEnabledAt: new Date() })
    ).toBe('change-password')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/authFlow.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/authFlow.ts`:

```ts
export type LoginStep = 'change-password' | 'mfa-enroll' | 'mfa-verify'

export interface PartnerLoginState {
  mustChangePassword: boolean
  totpEnabledAt: Date | null
}

export function resolveNextLoginStep(partner: PartnerLoginState): LoginStep {
  if (partner.mustChangePassword) return 'change-password'
  if (!partner.totpEnabledAt) return 'mfa-enroll'
  return 'mfa-verify'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/authFlow.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/authFlow.ts src/lib/authFlow.test.ts
git commit -m "feat: add login-step resolver"
```

---

### Task 7: Session helpers and middleware

**Files:**
- Create: `src/lib/session.ts`
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `interface SessionData { partnerId?: string; pendingPartnerId?: string }`, `getSession(): Promise<IronSession<SessionData>>`
- **Note:** this file (and `src/middleware.ts`) must never import `src/lib/password.ts`.

- [ ] **Step 1: Write the session helper**

`src/lib/session.ts`:

```ts
import { cookies } from 'next/headers'
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session'

export interface SessionData {
  partnerId?: string
  pendingPartnerId?: string
}

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'cwp_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}
```

- [ ] **Step 2: Write the middleware**

`src/middleware.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import type { SessionData } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/login/change-password', '/login/verify', '/login/enroll']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/')
  ) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, {
    password: process.env.SESSION_SECRET as string,
    cookieName: 'cwp_session',
    cookieOptions: { secure: process.env.NODE_ENV === 'production' },
  })

  if (!session.partnerId) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (Runtime redirect behavior is verified manually in Task 9 once login pages exist — visiting any protected path with no session cookie should redirect to `/login`.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/session.ts src/middleware.ts
git commit -m "feat: add session helper and auth-gating middleware"
```

---

### Task 8: Auth API routes

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/change-password/route.ts`
- Create: `src/app/api/auth/mfa/enroll/route.ts`
- Create: `src/app/api/auth/mfa/verify/route.ts`
- Create: `src/app/api/auth/logout/route.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `hashPassword`/`verifyPassword` (Task 5), `resolveNextLoginStep` (Task 6), `getSession` (Task 7)
- Produces: `POST /api/auth/login`, `POST /api/auth/change-password`, `POST /api/auth/mfa/enroll`, `POST /api/auth/mfa/verify`, `POST /api/auth/logout` — each returns `{ nextStep: LoginStep | 'done' }` or `{ ok: true }`.

- [ ] **Step 1: Login route**

`src/app/api/auth/login/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { resolveNextLoginStep } from '@/lib/authFlow'
import { getSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const partner = await prisma.brandPartner.findUnique({ where: { email } })
  if (!partner || !partner.isActive || !(await verifyPassword(password, partner.passwordHash))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const session = await getSession()
  session.pendingPartnerId = partner.id
  delete session.partnerId
  await session.save()

  const nextStep = resolveNextLoginStep(partner)
  return NextResponse.json({ nextStep })
}
```

- [ ] **Step 2: Change-password route**

`src/app/api/auth/change-password/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { resolveNextLoginStep } from '@/lib/authFlow'
import { getSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.pendingPartnerId) {
    return NextResponse.json({ error: 'No pending login session' }, { status: 401 })
  }

  const partner = await prisma.brandPartner.findUnique({ where: { id: session.pendingPartnerId } })
  if (!partner || !partner.mustChangePassword) {
    return NextResponse.json({ error: 'Password change is not required' }, { status: 409 })
  }

  const { newPassword } = await request.json()
  const passwordHash = await hashPassword(newPassword)

  const updated = await prisma.brandPartner.update({
    where: { id: partner.id },
    data: { passwordHash, mustChangePassword: false },
  })

  return NextResponse.json({ nextStep: resolveNextLoginStep(updated) })
}
```

- [ ] **Step 3: MFA enroll route**

`src/app/api/auth/mfa/enroll/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session.pendingPartnerId) {
    return NextResponse.json({ error: 'No pending login session' }, { status: 401 })
  }

  const partner = await prisma.brandPartner.findUnique({ where: { id: session.pendingPartnerId } })
  if (!partner || partner.totpEnabledAt) {
    return NextResponse.json({ error: 'Already enrolled' }, { status: 409 })
  }

  const secret = authenticator.generateSecret()
  const otpauthUrl = authenticator.keyuri(partner.email, 'Community Wellness Point', secret)

  session.pendingPartnerId = partner.id
  await session.save()

  // secret is re-derived and persisted only after successful verification (Step 4)
  return NextResponse.json({ secret, otpauthUrl })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.pendingPartnerId) {
    return NextResponse.json({ error: 'No pending login session' }, { status: 401 })
  }

  const { secret, token } = await request.json()
  const valid = authenticator.verify({ token, secret })
  if (!valid) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  await prisma.brandPartner.update({
    where: { id: session.pendingPartnerId },
    data: { totpSecretEnc: secret, totpEnabledAt: new Date() },
  })

  session.partnerId = session.pendingPartnerId
  delete session.pendingPartnerId
  await session.save()

  return NextResponse.json({ nextStep: 'done' })
}
```

- [ ] **Step 4: MFA verify route**

`src/app/api/auth/mfa/verify/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.pendingPartnerId) {
    return NextResponse.json({ error: 'No pending login session' }, { status: 401 })
  }

  const partner = await prisma.brandPartner.findUnique({ where: { id: session.pendingPartnerId } })
  if (!partner || !partner.totpSecretEnc) {
    return NextResponse.json({ error: 'MFA not enrolled' }, { status: 409 })
  }

  const { token } = await request.json()
  const valid = authenticator.verify({ token, secret: partner.totpSecretEnc })
  if (!valid) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  session.partnerId = partner.id
  delete session.pendingPartnerId
  await session.save()

  return NextResponse.json({ nextStep: 'done' })
}
```

- [ ] **Step 5: Logout route**

`src/app/api/auth/logout/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function POST() {
  const session = await getSession()
  session.destroy()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/auth
git commit -m "feat: add auth API routes (login, change-password, MFA enroll/verify, logout)"
```

---

### Task 9: Login UI pages

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/change-password/page.tsx`
- Create: `src/app/login/enroll/page.tsx`
- Create: `src/app/login/verify/page.tsx`

**Interfaces:**
- Consumes: the auth API routes from Task 8 (`POST /api/auth/login` etc.)

- [ ] **Step 1: Login page**

`src/app/login/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Form, Input, Typography, Alert } from 'antd'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const onFinish = async (values: { email: string; password: string }) => {
    setError(null)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Login failed')
      return
    }
    const routes: Record<string, string> = {
      'change-password': '/login/change-password',
      'mfa-enroll': '/login/enroll',
      'mfa-verify': '/login/verify',
    }
    router.push(routes[data.nextStep] ?? '/dashboard')
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10vh' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={3}>Community Wellness Point</Typography.Title>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Log in
          </Button>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Change-password page**

`src/app/login/change-password/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Form, Input, Typography, Alert } from 'antd'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const onFinish = async (values: { newPassword: string }) => {
    setError(null)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Could not change password')
      return
    }
    router.push(data.nextStep === 'mfa-enroll' ? '/login/enroll' : '/login/verify')
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10vh' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={4}>Set a new password</Typography.Title>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="newPassword"
            label="New password"
            rules={[{ required: true, min: 8 }]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Continue
          </Button>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: MFA enroll page**

`src/app/login/enroll/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Form, Input, Typography, Alert } from 'antd'

export default function EnrollPage() {
  const router = useRouter()
  const [secret, setSecret] = useState('')
  const [otpauthUrl, setOtpauthUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/mfa/enroll')
      .then((res) => res.json())
      .then((data) => {
        setSecret(data.secret)
        setOtpauthUrl(data.otpauthUrl)
      })
  }, [])

  const onFinish = async (values: { token: string }) => {
    setError(null)
    const res = await fetch('/api/auth/mfa/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, token: values.token }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Invalid code')
      return
    }
    router.push('/dashboard')
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10vh' }}>
      <Card style={{ width: 400 }}>
        <Typography.Title level={4}>Set up two-factor authentication</Typography.Title>
        <Typography.Paragraph>
          Scan this into an authenticator app, or enter the secret manually:
        </Typography.Paragraph>
        <Typography.Text code>{secret}</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ wordBreak: 'break-all', marginTop: 8 }}>
          {otpauthUrl}
        </Typography.Paragraph>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="token" label="6-digit code" rules={[{ required: true, len: 6 }]}>
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Verify and finish
          </Button>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: MFA verify page**

`src/app/login/verify/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Form, Input, Typography, Alert } from 'antd'

export default function VerifyPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const onFinish = async (values: { token: string }) => {
    setError(null)
    const res = await fetch('/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Invalid code')
      return
    }
    router.push('/dashboard')
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10vh' }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={4}>Enter your authenticator code</Typography.Title>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="token" label="6-digit code" rules={[{ required: true, len: 6 }]}>
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Log in
          </Button>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, visit `/login`, log in with `owner@communitywellnesspoint.local` / `ChangeMe123!` (seeded in Task 2).
Expected: redirected to change-password → enroll (scan/enter secret into an authenticator app or compute a TOTP manually) → lands on `/dashboard` (404 is fine — the Dashboard page doesn't exist until Task 23; confirm the URL and that no redirect loop occurs).

- [ ] **Step 6: Commit**

```bash
git add src/app/login
git commit -m "feat: add login, change-password, and MFA enroll/verify pages"
```

---

### Task 10: Authorization helper — current partner and permission guard

**Files:**
- Create: `src/lib/authz.ts`
- Test: `src/lib/authz.test.ts`

**Interfaces:**
- Consumes: `getSession` (Task 7), `prisma` (Task 2), `hasPermission`/`PermissionKey` (Task 4)
- Produces: `getCurrentPartner(): Promise<(BrandPartner & { role: Role }) | null>`, `requirePermission(partner: { role: { permissions: unknown } } | null, key: PermissionKey): boolean`

- [ ] **Step 1: Write the failing test for the pure guard function**

`src/lib/authz.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { requirePermission } from './authz'

describe('requirePermission', () => {
  it('returns false when partner is null', () => {
    expect(requirePermission(null, 'manageRoles')).toBe(false)
  })

  it('returns true when the role JSON has the permission set', () => {
    const partner = { role: { permissions: { manageRoles: true } } }
    expect(requirePermission(partner, 'manageRoles')).toBe(true)
  })

  it('returns false when the role JSON does not have the permission set', () => {
    const partner = { role: { permissions: { manageRoles: false } } }
    expect(requirePermission(partner, 'manageRoles')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/authz.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/authz.ts`:

```ts
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { hasPermission, type PermissionKey, type PermissionSet } from '@/lib/permissions'
import type { BrandPartner, Role } from '@prisma/client'

export type PartnerWithRole = BrandPartner & { role: Role }

export async function getCurrentPartner(): Promise<PartnerWithRole | null> {
  const session = await getSession()
  if (!session.partnerId) return null

  return prisma.brandPartner.findUnique({
    where: { id: session.partnerId },
    include: { role: true },
  })
}

export function requirePermission(
  partner: { role: { permissions: unknown } } | null,
  key: PermissionKey
): boolean {
  if (!partner) return false
  return hasPermission(partner.role.permissions as Partial<PermissionSet>, key)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/authz.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/authz.ts src/lib/authz.test.ts
git commit -m "feat: add current-partner lookup and permission guard"
```

---

### Task 11: App shell layout with responsive side panel

**Files:**
- Create: `src/components/layout/NavMenu.tsx`
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `getCurrentPartner` (Task 10), `requirePermission` (Task 10)
- Produces: `<AppShell partner={...}>{children}</AppShell>` — a client component wrapping Ant Design `Layout`/`Sider`/`Header`; used by every page under the `(app)` route group.

- [ ] **Step 1: Write the nav menu (permission-filtered, includes disabled Skin Analysis)**

`src/components/layout/NavMenu.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Tooltip } from 'antd'
import type { PermissionSet } from '@/lib/permissions'

export interface NavMenuProps {
  permissions: Partial<PermissionSet>
}

export function NavMenu({ permissions }: NavMenuProps) {
  const pathname = usePathname()

  const items = [
    { key: '/dashboard', label: <Link href="/dashboard">Dashboard</Link> },
    {
      key: 'health-assessment',
      label: 'Health Assessment',
      children: [
        { key: '/health-assessment/form', label: <Link href="/health-assessment/form">Form</Link> },
        { key: '/health-assessment/result', label: <Link href="/health-assessment/result">Result</Link> },
        {
          key: '/health-assessment/measurement',
          label: <Link href="/health-assessment/measurement">Measurement</Link>,
        },
      ],
    },
    {
      key: 'skin-analysis',
      disabled: true,
      label: (
        <Tooltip title="Coming soon">
          <span>Skin Analysis</span>
        </Tooltip>
      ),
    },
    {
      key: 'settings',
      label: 'Settings',
      children: [
        { key: '/settings/profile', label: <Link href="/settings/profile">My Profile</Link> },
        ...(permissions.manageRoles || permissions.managePartners
          ? [
              {
                key: '/settings/partners-roles',
                label: <Link href="/settings/partners-roles">Brand Partners &amp; Roles</Link>,
              },
            ]
          : []),
      ],
    },
  ]

  return (
    <Menu
      mode="inline"
      selectedKeys={[pathname]}
      defaultOpenKeys={['health-assessment', 'settings']}
      items={items}
    />
  )
}
```

- [ ] **Step 2: Write the AppShell**

`src/components/layout/AppShell.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Layout, Grid, Drawer, Button } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { NavMenu } from './NavMenu'
import type { PermissionSet } from '@/lib/permissions'

const { Header, Sider, Content } = Layout
const { useBreakpoint } = Grid

export interface AppShellProps {
  partnerName: string
  permissions: Partial<PermissionSet>
  children: React.ReactNode
}

export function AppShell({ partnerName, permissions, children }: AppShellProps) {
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          bodyStyle={{ padding: 0 }}
        >
          <NavMenu permissions={permissions} />
        </Drawer>
      ) : (
        <Sider breakpoint="md" collapsedWidth={0}>
          <NavMenu permissions={permissions} />
        </Sider>
      )}
      <Layout>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
          {isMobile && <Button icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />}
          <span>Community Wellness Point</span>
          <span>{partnerName}</span>
        </Header>
        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  )
}
```

- [ ] **Step 3: Wire the protected layout group**

`src/app/(app)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getCurrentPartner } from '@/lib/authz'
import { AppShell } from '@/components/layout/AppShell'
import type { PermissionSet } from '@/lib/permissions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const partner = await getCurrentPartner()
  if (!partner) redirect('/login')

  return (
    <AppShell
      partnerName={partner.name}
      permissions={partner.role.permissions as Partial<PermissionSet>}
    >
      {children}
    </AppShell>
  )
}
```

- [ ] **Step 4: Manual verification at three breakpoints**

Run: `npm run dev`, log in, resize the browser to 375px, 768px, and 1280px+.
Expected: at 375px/768px the Sider is replaced by a drawer opened via the header menu button; at 1280px+ the Sider is permanently visible. Skin Analysis is visible but greyed out with a "Coming soon" tooltip on hover.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout src/app/\(app\)/layout.tsx
git commit -m "feat: add responsive app shell with permission-filtered nav"
```

---

### Task 12: Assessment Zod schema and form field config (TDD)

**Files:**
- Create: `src/lib/assessmentSchema.ts`
- Test: `src/lib/assessmentSchema.test.ts`
- Create: `src/components/assessment-form/fieldConfig.ts`

**Interfaces:**
- Produces: `assessmentInputSchema` (Zod), `type AssessmentInput = z.infer<typeof assessmentInputSchema>`, `steps: StepConfig[]` (form field configuration consumed by the wizard in Task 14).

- [ ] **Step 1: Write the failing test**

`src/lib/assessmentSchema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { assessmentInputSchema } from './assessmentSchema'

describe('assessmentInputSchema', () => {
  it('accepts a valid minimal submission', () => {
    const result = assessmentInputSchema.safeParse({
      date: '2026-09-03',
      name: 'Jane Doe',
      contactNumber: '+60123456789',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a submission missing the required name', () => {
    const result = assessmentInputSchema.safeParse({
      date: '2026-09-03',
      contactNumber: '+60123456789',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a submission missing the required date', () => {
    const result = assessmentInputSchema.safeParse({
      name: 'Jane Doe',
      contactNumber: '+60123456789',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional numeric fields when present', () => {
    const result = assessmentInputSchema.safeParse({
      date: '2026-09-03',
      name: 'Jane Doe',
      contactNumber: '+60123456789',
      height: 170,
      weight: 70,
      systolicBp: 118,
      diastolicBp: 76,
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assessmentSchema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schema**

`src/lib/assessmentSchema.ts`:

```ts
import { z } from 'zod'

export const assessmentInputSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  date: z.string().min(1, 'Date is required'),
  name: z.string().min(1, 'Name is required'),
  contactNumber: z.string().min(1, 'Contact number is required'),
  age: z.number().int().positive().optional(),
  height: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  bodyFatPercent: z.number().min(0).max(100).optional(),
  visceralFatLevel: z.number().min(0).optional(),
  bmi: z.number().positive().optional(),
  restingMetabolism: z.number().positive().optional(),
  bodyAge: z.number().int().positive().optional(),
  systolicBp: z.number().int().positive().optional(),
  diastolicBp: z.number().int().positive().optional(),
  bloodGlucose: z.number().positive().optional(),
  remarks: z.string().optional(),
})

export type AssessmentInput = z.infer<typeof assessmentInputSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assessmentSchema.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the form field config (no referrer/activity step)**

`src/components/assessment-form/fieldConfig.ts`:

```ts
import type { AssessmentInput } from '@/lib/assessmentSchema'

export interface FieldConfig {
  key: keyof AssessmentInput
  label: string
  required?: boolean
  type: 'text' | 'email' | 'tel' | 'date' | 'number'
}

export interface StepConfig {
  title: string
  fields: FieldConfig[]
}

export const steps: StepConfig[] = [
  {
    title: 'Personal Info',
    fields: [
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'date', label: 'Date', required: true, type: 'date' },
      { key: 'name', label: 'Name', required: true, type: 'text' },
      { key: 'contactNumber', label: 'Contact Number', required: true, type: 'tel' },
      { key: 'age', label: 'Age', type: 'number' },
      { key: 'height', label: 'Height (cm)', type: 'number' },
    ],
  },
  {
    title: 'Body Composition',
    fields: [
      { key: 'weight', label: 'Weight (kg)', type: 'number' },
      { key: 'bodyFatPercent', label: 'Body Fat (%)', type: 'number' },
      { key: 'visceralFatLevel', label: 'Visceral Fat Level', type: 'number' },
      { key: 'restingMetabolism', label: 'Resting Metabolism', type: 'number' },
      { key: 'bmi', label: 'BMI (kg/m2)', type: 'number' },
      { key: 'bodyAge', label: 'Body Age', type: 'number' },
    ],
  },
  {
    title: 'Blood Pressure (Normal: < 120/80 mmHg)',
    fields: [
      { key: 'systolicBp', label: 'Systolic BP (mmHg)', type: 'number' },
      { key: 'diastolicBp', label: 'Diastolic BP (mmHg)', type: 'number' },
    ],
  },
  {
    title: 'Blood Glucose',
    fields: [{ key: 'bloodGlucose', label: 'Blood Glucose Level (mmol/L)', type: 'number' }],
  },
  {
    title: 'Notes',
    fields: [{ key: 'remarks', label: 'Remarks', type: 'text' }],
  },
]
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/assessmentSchema.ts src/lib/assessmentSchema.test.ts src/components/assessment-form/fieldConfig.ts
git commit -m "feat: add assessment validation schema and form field config"
```

---

### Task 13: Assessment create API route

**Files:**
- Create: `src/app/api/assessments/route.ts` (POST only in this task — GET is added in Task 15)

**Interfaces:**
- Consumes: `assessmentInputSchema` (Task 12), `getCurrentPartner` (Task 10), `calculateBmi` (Task 3), `prisma` (Task 2)
- Produces: `POST /api/assessments` → creates an `Assessment` with `handledByPartnerId` set from the session.

- [ ] **Step 1: Implement the POST handler**

`src/app/api/assessments/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner } from '@/lib/authz'
import { assessmentInputSchema } from '@/lib/assessmentSchema'
import { calculateBmi } from '@/lib/bmi'

export async function POST(request: NextRequest) {
  const partner = await getCurrentPartner()
  if (!partner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = assessmentInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const input = parsed.data
  const bmi = input.bmi ?? calculateBmi(input.height ?? null, input.weight ?? null) ?? undefined

  const assessment = await prisma.assessment.create({
    data: {
      ...input,
      email: input.email || undefined,
      date: new Date(input.date),
      bmi,
      handledByPartnerId: partner.id,
    },
  })

  return NextResponse.json({ assessment }, { status: 201 })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, log in, then from the browser console or a REST client:

```bash
curl -X POST http://localhost:3000/api/assessments \
  -H "Content-Type: application/json" \
  --cookie "cwp_session=<paste from browser devtools>" \
  -d '{"date":"2026-09-03","name":"Jane Doe","contactNumber":"+60123456789","height":170,"weight":70}'
```

Expected: `201` with the created assessment JSON, `bmi` auto-calculated to `24.2`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/assessments/route.ts
git commit -m "feat: add assessment creation API route"
```

---

### Task 14: Health Assessment Form UI (multi-step wizard)

**Files:**
- Create: `src/components/assessment-form/AssessmentWizard.tsx`
- Create: `src/app/(app)/health-assessment/form/page.tsx`

**Interfaces:**
- Consumes: `steps` field config (Task 12), `POST /api/assessments` (Task 13)

- [ ] **Step 1: Write the wizard component**

`src/components/assessment-form/AssessmentWizard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Steps, Form, Input, InputNumber, DatePicker, Button, Alert, Space } from 'antd'
import dayjs from 'dayjs'
import { steps } from './fieldConfig'

export function AssessmentWizard() {
  const router = useRouter()
  const [current, setCurrent] = useState(0)
  const [form] = Form.useForm()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isLastStep = current === steps.length - 1

  const next = async () => {
    await form.validateFields(steps[current].fields.map((f) => f.key))
    setCurrent((c) => c + 1)
  }

  const prev = () => setCurrent((c) => c - 1)

  const onFinish = async () => {
    setSubmitting(true)
    setError(null)
    const values = form.getFieldsValue(true)
    const payload = { ...values, date: values.date ? dayjs(values.date).format('YYYY-MM-DD') : undefined }

    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSubmitting(false)
    if (!res.ok) {
      setError('Could not save this assessment. Please check the fields and try again.')
      return
    }
    router.push('/health-assessment/result')
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <Steps current={current} items={steps.map((s) => ({ title: s.title }))} style={{ marginBottom: 24 }} />
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={onFinish}>
        {steps.map((step, index) => (
          <div key={step.title} style={{ display: index === current ? 'block' : 'none' }}>
            {step.fields.map((field) => (
              <Form.Item
                key={field.key}
                name={field.key}
                label={field.label}
                rules={field.required ? [{ required: true, message: `${field.label} is required` }] : []}
              >
                {field.type === 'number' ? (
                  <InputNumber style={{ width: '100%' }} />
                ) : field.type === 'date' ? (
                  <DatePicker style={{ width: '100%' }} />
                ) : (
                  <Input type={field.type} />
                )}
              </Form.Item>
            ))}
          </div>
        ))}
        <Space>
          {current > 0 && <Button onClick={prev}>Back</Button>}
          {!isLastStep && (
            <Button type="primary" onClick={next}>
              Next
            </Button>
          )}
          {isLastStep && (
            <Button type="primary" htmlType="submit" loading={submitting}>
              Save Assessment
            </Button>
          )}
        </Space>
      </Form>
    </div>
  )
}
```

```bash
npm install dayjs
```

- [ ] **Step 2: Write the page**

`src/app/(app)/health-assessment/form/page.tsx`:

```tsx
import { AssessmentWizard } from '@/components/assessment-form/AssessmentWizard'

export default function HealthAssessmentFormPage() {
  return <AssessmentWizard />
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, navigate to `/health-assessment/form`, step through all five pages filling in a name/date/contact and a few measurements, submit.
Expected: redirected to `/health-assessment/result` (404 is fine until Task 16 — confirm no client error and the network tab shows a `201` from `POST /api/assessments`). Re-test at 375px width: fields stack vertically and `Steps` remains usable.

- [ ] **Step 4: Commit**

```bash
git add src/components/assessment-form/AssessmentWizard.tsx "src/app/(app)/health-assessment/form" package.json package-lock.json
git commit -m "feat: add multi-step Health Assessment form"
```

---

### Task 15: Assessment query-builder (TDD) and list/export API routes

**Files:**
- Create: `src/lib/assessmentQuery.ts`
- Test: `src/lib/assessmentQuery.test.ts`
- Modify: `src/app/api/assessments/route.ts` (add GET)
- Create: `src/lib/export.ts`
- Test: `src/lib/export.test.ts`
- Create: `src/app/api/assessments/export/route.ts`

**Interfaces:**
- Produces: `buildAssessmentWhere(filters, ctx): Prisma.AssessmentWhereInput`, `toExportRow(assessment): AssessmentExportRow`
- Consumes: `requirePermission` (Task 10), `getCurrentPartner` (Task 10), `prisma` (Task 2)

- [ ] **Step 1: Write the failing test for the query builder**

`src/lib/assessmentQuery.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildAssessmentWhere } from './assessmentQuery'

describe('buildAssessmentWhere', () => {
  it('scopes to the current partner when canViewAll is false', () => {
    const where = buildAssessmentWhere({}, { currentPartnerId: 'p1', canViewAll: false })
    expect(where.handledByPartnerId).toBe('p1')
  })

  it('ignores the partnerId filter when canViewAll is false', () => {
    const where = buildAssessmentWhere(
      { partnerId: 'p2' },
      { currentPartnerId: 'p1', canViewAll: false }
    )
    expect(where.handledByPartnerId).toBe('p1')
  })

  it('applies the partnerId filter when canViewAll is true', () => {
    const where = buildAssessmentWhere(
      { partnerId: 'p2' },
      { currentPartnerId: 'p1', canViewAll: true }
    )
    expect(where.handledByPartnerId).toBe('p2')
  })

  it('leaves handledByPartnerId unset when canViewAll is true and no partnerId filter given', () => {
    const where = buildAssessmentWhere({}, { currentPartnerId: 'p1', canViewAll: true })
    expect(where.handledByPartnerId).toBeUndefined()
  })

  it('builds a date range filter', () => {
    const where = buildAssessmentWhere(
      { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
      { currentPartnerId: 'p1', canViewAll: true }
    )
    expect(where.date).toEqual({ gte: new Date('2026-01-01'), lte: new Date('2026-01-31') })
  })

  it('builds a name/contact search filter', () => {
    const where = buildAssessmentWhere(
      { search: 'jane' },
      { currentPartnerId: 'p1', canViewAll: true }
    )
    expect(where.OR).toEqual([
      { name: { contains: 'jane', mode: 'insensitive' } },
      { contactNumber: { contains: 'jane', mode: 'insensitive' } },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assessmentQuery.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the query builder**

`src/lib/assessmentQuery.ts`:

```ts
import type { Prisma } from '@prisma/client'

export interface AssessmentFilters {
  dateFrom?: string
  dateTo?: string
  search?: string
  partnerId?: string
}

export interface QueryContext {
  currentPartnerId: string
  canViewAll: boolean
}

export function buildAssessmentWhere(
  filters: AssessmentFilters,
  ctx: QueryContext
): Prisma.AssessmentWhereInput {
  const where: Prisma.AssessmentWhereInput = {}

  if (!ctx.canViewAll) {
    where.handledByPartnerId = ctx.currentPartnerId
  } else if (filters.partnerId) {
    where.handledByPartnerId = filters.partnerId
  }

  if (filters.dateFrom || filters.dateTo) {
    where.date = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    }
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { contactNumber: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  return where
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assessmentQuery.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Add the GET handler to the assessments route**

Modify `src/app/api/assessments/route.ts` — add alongside the existing `POST`:

```ts
import { buildAssessmentWhere } from '@/lib/assessmentQuery'
import { requirePermission } from '@/lib/authz'

export async function GET(request: NextRequest) {
  const partner = await getCurrentPartner()
  if (!partner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const where = buildAssessmentWhere(
    {
      dateFrom: url.searchParams.get('dateFrom') ?? undefined,
      dateTo: url.searchParams.get('dateTo') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      partnerId: url.searchParams.get('partnerId') ?? undefined,
    },
    { currentPartnerId: partner.id, canViewAll: requirePermission(partner, 'viewAllAssessments') }
  )

  const assessments = await prisma.assessment.findMany({
    where,
    include: { handledByPartner: { select: { name: true } } },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({ assessments })
}
```

- [ ] **Step 6: Write the failing test for the export row mapper**

`src/lib/export.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toExportRow } from './export'

describe('toExportRow', () => {
  it('maps an assessment to a flat export row', () => {
    const row = toExportRow({
      name: 'Jane Doe',
      contactNumber: '+60123456789',
      date: new Date('2026-09-03'),
      height: 170,
      weight: 70,
      bmi: 24.2,
      bodyFatPercent: 22,
      visceralFatLevel: 4,
      systolicBp: 118,
      diastolicBp: 76,
      bloodGlucose: 5.2,
      handledByPartner: { name: 'Alex Tan' },
    })

    expect(row).toEqual({
      Name: 'Jane Doe',
      'Contact Number': '+60123456789',
      Date: '2026-09-03',
      'Height (cm)': 170,
      'Weight (kg)': 70,
      BMI: 24.2,
      'Body Fat (%)': 22,
      'Visceral Fat Level': 4,
      'Systolic BP': 118,
      'Diastolic BP': 76,
      'Blood Glucose': 5.2,
      'Handled By': 'Alex Tan',
    })
  })

  it('fills missing numeric fields with an empty string', () => {
    const row = toExportRow({
      name: 'Jane Doe',
      contactNumber: '+60123456789',
      date: new Date('2026-09-03'),
      height: null,
      weight: null,
      bmi: null,
      bodyFatPercent: null,
      visceralFatLevel: null,
      systolicBp: null,
      diastolicBp: null,
      bloodGlucose: null,
      handledByPartner: { name: 'Alex Tan' },
    })

    expect(row['Height (cm)']).toBe('')
    expect(row.BMI).toBe('')
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/lib/export.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 8: Implement the export mapper**

`src/lib/export.ts`:

```ts
export interface AssessmentExportRow {
  Name: string
  'Contact Number': string
  Date: string
  'Height (cm)': number | ''
  'Weight (kg)': number | ''
  BMI: number | ''
  'Body Fat (%)': number | ''
  'Visceral Fat Level': number | ''
  'Systolic BP': number | ''
  'Diastolic BP': number | ''
  'Blood Glucose': number | ''
  'Handled By': string
}

export interface AssessmentForExport {
  name: string
  contactNumber: string
  date: Date
  height: number | null
  weight: number | null
  bmi: number | null
  bodyFatPercent: number | null
  visceralFatLevel: number | null
  systolicBp: number | null
  diastolicBp: number | null
  bloodGlucose: number | null
  handledByPartner: { name: string }
}

export function toExportRow(a: AssessmentForExport): AssessmentExportRow {
  return {
    Name: a.name,
    'Contact Number': a.contactNumber,
    Date: a.date.toISOString().slice(0, 10),
    'Height (cm)': a.height ?? '',
    'Weight (kg)': a.weight ?? '',
    BMI: a.bmi ?? '',
    'Body Fat (%)': a.bodyFatPercent ?? '',
    'Visceral Fat Level': a.visceralFatLevel ?? '',
    'Systolic BP': a.systolicBp ?? '',
    'Diastolic BP': a.diastolicBp ?? '',
    'Blood Glucose': a.bloodGlucose ?? '',
    'Handled By': a.handledByPartner.name,
  }
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/lib/export.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 10: Write the export API route**

`src/app/api/assessments/export/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { buildAssessmentWhere } from '@/lib/assessmentQuery'
import { toExportRow } from '@/lib/export'

export async function GET(request: NextRequest) {
  const partner = await getCurrentPartner()
  if (!partner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const where = buildAssessmentWhere(
    {
      dateFrom: url.searchParams.get('dateFrom') ?? undefined,
      dateTo: url.searchParams.get('dateTo') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      partnerId: url.searchParams.get('partnerId') ?? undefined,
    },
    { currentPartnerId: partner.id, canViewAll: requirePermission(partner, 'viewAllAssessments') }
  )

  const assessments = await prisma.assessment.findMany({
    where,
    include: { handledByPartner: { select: { name: true } } },
    orderBy: { date: 'desc' },
  })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Results')
  const rows = assessments.map(toExportRow)
  if (rows.length > 0) {
    sheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key }))
    sheet.addRows(rows)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="wellness-results.xlsx"',
    },
  })
}
```

- [ ] **Step 11: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add src/lib/assessmentQuery.ts src/lib/assessmentQuery.test.ts src/lib/export.ts src/lib/export.test.ts src/app/api/assessments
git commit -m "feat: add assessment list/export API routes with permission-scoped query builder"
```

---

### Task 16: Results table UI with filters and export

**Files:**
- Create: `src/components/results/ResultsFilters.tsx`
- Create: `src/components/results/ResultsTable.tsx`
- Create: `src/app/(app)/health-assessment/result/page.tsx`

**Interfaces:**
- Consumes: `GET /api/assessments`, `GET /api/assessments/export` (Task 15)

- [ ] **Step 1: Write the filters bar**

`src/components/results/ResultsFilters.tsx`:

```tsx
'use client'

import { DatePicker, Input, Space } from 'antd'
import type { Dayjs } from 'dayjs'

const { RangePicker } = DatePicker

export interface ResultsFilterValue {
  search: string
  dateRange: [Dayjs, Dayjs] | null
}

export interface ResultsFiltersProps {
  value: ResultsFilterValue
  onChange: (value: ResultsFilterValue) => void
}

export function ResultsFilters({ value, onChange }: ResultsFiltersProps) {
  return (
    <Space wrap style={{ marginBottom: 16 }}>
      <Input.Search
        placeholder="Search name or contact number"
        allowClear
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        style={{ width: 260 }}
      />
      <RangePicker
        value={value.dateRange}
        onChange={(dates) => onChange({ ...value, dateRange: dates as [Dayjs, Dayjs] | null })}
      />
    </Space>
  )
}
```

- [ ] **Step 2: Write the results table**

`src/components/results/ResultsTable.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Space } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { ResultsFilters, type ResultsFilterValue } from './ResultsFilters'

interface AssessmentRow {
  id: string
  name: string
  contactNumber: string
  date: string
  bmi: number | null
  systolicBp: number | null
  diastolicBp: number | null
  handledByPartner: { name: string }
}

export function ResultsTable() {
  const router = useRouter()
  const [rows, setRows] = useState<AssessmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ResultsFilterValue>({ search: '', dateRange: null })

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.search) params.set('search', filters.search)
    if (filters.dateRange) {
      params.set('dateFrom', filters.dateRange[0].format('YYYY-MM-DD'))
      params.set('dateTo', filters.dateRange[1].format('YYYY-MM-DD'))
    }
    return params.toString()
  }, [filters])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/assessments?${queryString}`)
      .then((res) => res.json())
      .then((data) => setRows(data.assessments ?? []))
      .finally(() => setLoading(false))
  }, [queryString])

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <ResultsFilters value={filters} onChange={setFilters} />
        <Button
          icon={<DownloadOutlined />}
          href={`/api/assessments/export?${queryString}`}
        >
          Export to Excel
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        scroll={{ x: true }}
        onRow={(record) => ({
          onClick: () => router.push(`/health-assessment/result/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Contact', dataIndex: 'contactNumber' },
          { title: 'Date', dataIndex: 'date', render: (d: string) => d.slice(0, 10) },
          { title: 'BMI', dataIndex: 'bmi' },
          {
            title: 'BP',
            render: (_: unknown, r: AssessmentRow) =>
              r.systolicBp && r.diastolicBp ? `${r.systolicBp}/${r.diastolicBp}` : '-',
          },
          { title: 'Handled By', dataIndex: ['handledByPartner', 'name'] },
        ]}
      />
    </div>
  )
}
```

- [ ] **Step 3: Write the page**

`src/app/(app)/health-assessment/result/page.tsx`:

```tsx
import { ResultsTable } from '@/components/results/ResultsTable'

export default function ResultPage() {
  return <ResultsTable />
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, navigate to `/health-assessment/result`.
Expected: the assessment created in Task 14 appears in the table; searching by name/contact filters it; the date range picker filters it; "Export to Excel" downloads a `.xlsx` file with the expected columns. At 375px width the table scrolls horizontally instead of overflowing the page.

- [ ] **Step 5: Commit**

```bash
git add src/components/results "src/app/(app)/health-assessment/result"
git commit -m "feat: add Results table with filters and Excel export"
```

---

### Task 17: Assessment detail API route and Result detail page

**Files:**
- Create: `src/app/api/assessments/[id]/route.ts`
- Create: `src/app/(app)/health-assessment/result/[id]/page.tsx`

**Interfaces:**
- Consumes: `getCurrentPartner`, `requirePermission` (Task 10), `prisma` (Task 2)

- [ ] **Step 1: Write the detail API route (permission-scoped)**

`src/app/api/assessments/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const partner = await getCurrentPartner()
  if (!partner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: { handledByPartner: { select: { name: true } } },
  })

  if (!assessment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const canViewAll = requirePermission(partner, 'viewAllAssessments')
  if (!canViewAll && assessment.handledByPartnerId !== partner.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ assessment })
}
```

- [ ] **Step 2: Write the detail page with a disabled "Download PDF" placeholder**

`src/app/(app)/health-assessment/result/[id]/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Descriptions, Button, Tooltip, Skeleton } from 'antd'

interface AssessmentDetail {
  name: string
  contactNumber: string
  date: string
  height: number | null
  weight: number | null
  bmi: number | null
  bodyFatPercent: number | null
  visceralFatLevel: number | null
  systolicBp: number | null
  diastolicBp: number | null
  bloodGlucose: number | null
  remarks: string | null
  handledByPartner: { name: string }
}

export default function ResultDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null)

  useEffect(() => {
    fetch(`/api/assessments/${id}`)
      .then((res) => res.json())
      .then((data) => setAssessment(data.assessment))
  }, [id])

  if (!assessment) return <Skeleton active />

  return (
    <div>
      <Descriptions title={assessment.name} bordered column={1} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Contact">{assessment.contactNumber}</Descriptions.Item>
        <Descriptions.Item label="Date">{assessment.date.slice(0, 10)}</Descriptions.Item>
        <Descriptions.Item label="Height / Weight">
          {assessment.height ?? '-'} cm / {assessment.weight ?? '-'} kg
        </Descriptions.Item>
        <Descriptions.Item label="BMI">{assessment.bmi ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Body Fat / Visceral Fat">
          {assessment.bodyFatPercent ?? '-'}% / {assessment.visceralFatLevel ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Blood Pressure">
          {assessment.systolicBp ?? '-'}/{assessment.diastolicBp ?? '-'} mmHg
        </Descriptions.Item>
        <Descriptions.Item label="Blood Glucose">{assessment.bloodGlucose ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Remarks">{assessment.remarks ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Handled By">{assessment.handledByPartner.name}</Descriptions.Item>
      </Descriptions>
      <Tooltip title="PDF report generation is coming soon">
        <Button disabled>Download PDF</Button>
      </Tooltip>
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, click a row in the Results table from Task 16.
Expected: navigates to `/health-assessment/result/<id>`, shows the full record, "Download PDF" is visibly disabled with a tooltip on hover.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/assessments/[id]" "src/app/(app)/health-assessment/result/[id]"
git commit -m "feat: add assessment detail route and Result detail page"
```

---

### Task 18: Measurement reference page (static content)

**Files:**
- Create: `src/lib/measurementRanges.ts`
- Create: `src/app/(app)/health-assessment/measurement/page.tsx`

**Interfaces:**
- Produces: `MEASUREMENT_RANGES: { label: string; normalRange: string }[]`

- [ ] **Step 1: Write the static content**

`src/lib/measurementRanges.ts`:

```ts
export interface MeasurementRange {
  label: string
  normalRange: string
}

export const MEASUREMENT_RANGES: MeasurementRange[] = [
  { label: 'Blood Pressure', normalRange: 'Normal: < 120/80 mmHg' },
  { label: 'Visceral Fat Level', normalRange: 'Normal: ≤ 5' },
  { label: 'Body Fat Percentage', normalRange: 'Normal: 10–20% (male), 18–28% (female)' },
  { label: 'BMI', normalRange: 'Normal: 18.5–24.9 kg/m²' },
  { label: 'Blood Glucose (fasting)', normalRange: 'Normal: 4.0–5.9 mmol/L' },
]
```

- [ ] **Step 2: Write the page**

`src/app/(app)/health-assessment/measurement/page.tsx`:

```tsx
import { Card, List, Typography } from 'antd'
import { MEASUREMENT_RANGES } from '@/lib/measurementRanges'

export default function MeasurementPage() {
  return (
    <Card title="Normal Measurement Ranges">
      <List
        dataSource={MEASUREMENT_RANGES}
        renderItem={(item) => (
          <List.Item>
            <Typography.Text strong>{item.label}</Typography.Text>
            <Typography.Text style={{ marginLeft: 8 }}>{item.normalRange}</Typography.Text>
          </List.Item>
        )}
      />
    </Card>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, navigate to `/health-assessment/measurement`.
Expected: static list of ranges renders, no network request for it, readable at 375px width.

- [ ] **Step 4: Commit**

```bash
git add src/lib/measurementRanges.ts "src/app/(app)/health-assessment/measurement"
git commit -m "feat: add static Measurement reference page"
```

---

### Task 19: Role/Partner Zod schemas and system-role guard (TDD)

**Files:**
- Create: `src/lib/roleSchema.ts`
- Test: `src/lib/roleSchema.test.ts`
- Create: `src/lib/partnerSchema.ts`
- Test: `src/lib/partnerSchema.test.ts`
- Create: `src/lib/roleGuard.ts`
- Test: `src/lib/roleGuard.test.ts`

**Interfaces:**
- Produces: `roleInputSchema`, `partnerInputSchema` (Zod), `SystemRoleProtectedError`, `assertRoleMutable(role: { isSystemDefault: boolean }): void`

- [ ] **Step 1: Write the failing tests**

`src/lib/roleSchema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { roleInputSchema } from './roleSchema'

describe('roleInputSchema', () => {
  it('accepts a valid role', () => {
    const result = roleInputSchema.safeParse({
      name: 'Wellness Champion',
      permissions: { viewAllAssessments: true, manageRoles: false, managePartners: false, exportData: true, deleteRecords: false },
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = roleInputSchema.safeParse({ name: '', permissions: {} })
    expect(result.success).toBe(false)
  })
})
```

`src/lib/partnerSchema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { partnerInputSchema } from './partnerSchema'

describe('partnerInputSchema', () => {
  it('accepts a valid partner invite', () => {
    const result = partnerInputSchema.safeParse({
      name: 'Alex Tan',
      email: 'alex@example.com',
      roleId: 'role_123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = partnerInputSchema.safeParse({
      name: 'Alex Tan',
      email: 'not-an-email',
      roleId: 'role_123',
    })
    expect(result.success).toBe(false)
  })
})
```

`src/lib/roleGuard.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { assertRoleMutable, SystemRoleProtectedError } from './roleGuard'

describe('assertRoleMutable', () => {
  it('does not throw for a non-system role', () => {
    expect(() => assertRoleMutable({ isSystemDefault: false })).not.toThrow()
  })

  it('throws SystemRoleProtectedError for the system default role', () => {
    expect(() => assertRoleMutable({ isSystemDefault: true })).toThrow(SystemRoleProtectedError)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/roleSchema.test.ts src/lib/partnerSchema.test.ts src/lib/roleGuard.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `roleSchema.ts`**

```ts
import { z } from 'zod'
import { PERMISSION_KEYS } from './permissions'

const permissionsShape = Object.fromEntries(
  PERMISSION_KEYS.map((key) => [key, z.boolean().optional()])
) as Record<(typeof PERMISSION_KEYS)[number], z.ZodOptional<z.ZodBoolean>>

export const roleInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  permissions: z.object(permissionsShape),
})

export type RoleInput = z.infer<typeof roleInputSchema>
```

- [ ] **Step 4: Implement `partnerSchema.ts`**

```ts
import { z } from 'zod'

export const partnerInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('A valid email is required'),
  roleId: z.string().min(1, 'A role is required'),
})

export type PartnerInput = z.infer<typeof partnerInputSchema>
```

- [ ] **Step 5: Implement `roleGuard.ts`**

```ts
export class SystemRoleProtectedError extends Error {
  constructor() {
    super('The default system role cannot be modified or deleted.')
    this.name = 'SystemRoleProtectedError'
  }
}

export function assertRoleMutable(role: { isSystemDefault: boolean }): void {
  if (role.isSystemDefault) {
    throw new SystemRoleProtectedError()
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/lib/roleSchema.test.ts src/lib/partnerSchema.test.ts src/lib/roleGuard.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```bash
git add src/lib/roleSchema.ts src/lib/roleSchema.test.ts src/lib/partnerSchema.ts src/lib/partnerSchema.test.ts src/lib/roleGuard.ts src/lib/roleGuard.test.ts
git commit -m "feat: add role/partner validation schemas and system-role guard"
```

---

### Task 20: Roles and Partners CRUD API routes

**Files:**
- Create: `src/app/api/roles/route.ts`
- Create: `src/app/api/roles/[id]/route.ts`
- Create: `src/app/api/partners/route.ts`
- Create: `src/app/api/partners/[id]/route.ts`

**Interfaces:**
- Consumes: `roleInputSchema`, `partnerInputSchema` (Task 19), `assertRoleMutable`/`SystemRoleProtectedError` (Task 19), `getCurrentPartner`/`requirePermission` (Task 10), `hashPassword` (Task 5)

- [ ] **Step 1: Roles list/create route**

`src/app/api/roles/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { roleInputSchema } from '@/lib/roleSchema'

export async function GET() {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'manageRoles')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ roles })
}

export async function POST(request: NextRequest) {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'manageRoles')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = roleInputSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const role = await prisma.role.create({ data: parsed.data })
  return NextResponse.json({ role }, { status: 201 })
}
```

- [ ] **Step 2: Roles update/delete route**

`src/app/api/roles/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { roleInputSchema } from '@/lib/roleSchema'
import { assertRoleMutable, SystemRoleProtectedError } from '@/lib/roleGuard'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'manageRoles')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const role = await prisma.role.findUnique({ where: { id: params.id } })
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    assertRoleMutable(role)
  } catch (e) {
    if (e instanceof SystemRoleProtectedError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    throw e
  }

  const parsed = roleInputSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.role.update({ where: { id: role.id }, data: parsed.data })
  return NextResponse.json({ role: updated })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'manageRoles')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const role = await prisma.role.findUnique({ where: { id: params.id } })
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    assertRoleMutable(role)
  } catch (e) {
    if (e instanceof SystemRoleProtectedError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    throw e
  }

  await prisma.role.delete({ where: { id: role.id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Partners list/create (invite) route**

`src/app/api/partners/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { partnerInputSchema } from '@/lib/partnerSchema'
import { hashPassword } from '@/lib/password'
import { randomBytes } from 'crypto'

export async function GET() {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'managePartners')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const partners = await prisma.brandPartner.findMany({
    include: { role: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ partners })
}

export async function POST(request: NextRequest) {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'managePartners')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = partnerInputSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const temporaryPassword = randomBytes(9).toString('base64url')
  const passwordHash = await hashPassword(temporaryPassword)

  const created = await prisma.brandPartner.create({
    data: { ...parsed.data, passwordHash, mustChangePassword: true },
  })

  return NextResponse.json({ partner: created, temporaryPassword }, { status: 201 })
}
```

- [ ] **Step 4: Partners update (edit/deactivate/reassign role) route**

`src/app/api/partners/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { z } from 'zod'

const partnerUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  roleId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const partner = await getCurrentPartner()
  if (!partner || !requirePermission(partner, 'managePartners')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = partnerUpdateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.brandPartner.update({
    where: { id: params.id },
    data: parsed.data,
  })

  return NextResponse.json({ partner: updated })
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, log in as the seeded Owner (which has `manageRoles`/`managePartners` from Task 2's seed), exercise each route with `curl` (as in Task 13 Step 3) or the browser devtools console.
Expected: creating/updating/deleting a non-system role succeeds; attempting to `PATCH`/`DELETE` the seeded "Owner" role returns `409`; creating a partner returns a `temporaryPassword` in the response.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/roles src/app/api/partners
git commit -m "feat: add Roles and Brand Partners CRUD API routes"
```

---

### Task 21: Settings UI — Brand Partners & Roles, My Profile

**Files:**
- Create: `src/components/settings/RolesPanel.tsx`
- Create: `src/components/settings/PartnersPanel.tsx`
- Create: `src/app/(app)/settings/partners-roles/page.tsx`
- Create: `src/app/(app)/settings/profile/page.tsx`

**Interfaces:**
- Consumes: `/api/roles`, `/api/partners` (Task 20)

- [ ] **Step 1: Write the Roles panel**

`src/components/settings/RolesPanel.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Checkbox, Space } from 'antd'
import { PERMISSION_KEYS, type PermissionKey } from '@/lib/permissions'

interface RoleRow {
  id: string
  name: string
  isSystemDefault: boolean
  permissions: Partial<Record<PermissionKey, boolean>>
}

export function RolesPanel() {
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RoleRow | null>(null)
  const [form] = Form.useForm()

  const load = () => fetch('/api/roles').then((res) => res.json()).then((data) => setRoles(data.roles ?? []))

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (role: RoleRow) => {
    setEditing(role)
    form.setFieldsValue({ name: role.name, ...role.permissions })
    setModalOpen(true)
  }

  const onSubmit = async () => {
    const values = await form.validateFields()
    const permissions = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, Boolean(values[key])]))
    const body = JSON.stringify({ name: values.name, permissions })

    if (editing) {
      await fetch(`/api/roles/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body })
    } else {
      await fetch('/api/roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    }
    setModalOpen(false)
    load()
  }

  const onDelete = async (role: RoleRow) => {
    await fetch(`/api/roles/${role.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <Button type="primary" onClick={openCreate} style={{ marginBottom: 16 }}>
        New Role
      </Button>
      <Table
        rowKey="id"
        dataSource={roles}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          {
            title: 'Permissions',
            render: (_: unknown, r: RoleRow) =>
              PERMISSION_KEYS.filter((k) => r.permissions[k]).join(', ') || '-',
          },
          {
            title: 'Actions',
            render: (_: unknown, r: RoleRow) => (
              <Space>
                <Button size="small" onClick={() => openEdit(r)} disabled={r.isSystemDefault}>
                  Edit
                </Button>
                <Button size="small" danger onClick={() => onDelete(r)} disabled={r.isSystemDefault}>
                  Delete
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal open={modalOpen} title={editing ? 'Edit Role' : 'New Role'} onCancel={() => setModalOpen(false)} onOk={onSubmit}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Role name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Wellness Champion" />
          </Form.Item>
          {PERMISSION_KEYS.map((key) => (
            <Form.Item key={key} name={key} valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>{key}</Checkbox>
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 2: Write the Partners panel**

`src/components/settings/PartnersPanel.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, message } from 'antd'

interface RoleOption {
  id: string
  name: string
}

interface PartnerRow {
  id: string
  name: string
  email: string
  isActive: boolean
  role: RoleOption
}

export function PartnersPanel() {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    fetch('/api/partners').then((res) => res.json()).then((data) => setPartners(data.partners ?? []))
    fetch('/api/roles').then((res) => res.json()).then((data) => setRoles(data.roles ?? []))
  }

  useEffect(() => {
    load()
  }, [])

  const onInvite = async () => {
    const values = await form.validateFields()
    const res = await fetch('/api/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json()
    if (res.ok) {
      message.success(`Invited. Temporary password: ${data.temporaryPassword}`)
      setModalOpen(false)
      load()
    }
  }

  const toggleActive = async (partner: PartnerRow) => {
    await fetch(`/api/partners/${partner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !partner.isActive }),
    })
    load()
  }

  return (
    <div>
      <Button type="primary" onClick={() => setModalOpen(true)} style={{ marginBottom: 16 }}>
        Invite Brand Partner
      </Button>
      <Table
        rowKey="id"
        dataSource={partners}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Email', dataIndex: 'email' },
          { title: 'Role', render: (_: unknown, r: PartnerRow) => r.role.name },
          { title: 'Active', render: (_: unknown, r: PartnerRow) => (r.isActive ? 'Yes' : 'No') },
          {
            title: 'Actions',
            render: (_: unknown, r: PartnerRow) => (
              <Space>
                <Button size="small" onClick={() => toggleActive(r)}>
                  {r.isActive ? 'Deactivate' : 'Reactivate'}
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal open={modalOpen} title="Invite Brand Partner" onCancel={() => setModalOpen(false)} onOk={onInvite}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="roleId" label="Role" rules={[{ required: true }]}>
            <Select options={roles.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 3: Write the combined settings page**

`src/app/(app)/settings/partners-roles/page.tsx`:

```tsx
'use client'

import { Tabs } from 'antd'
import { RolesPanel } from '@/components/settings/RolesPanel'
import { PartnersPanel } from '@/components/settings/PartnersPanel'

export default function PartnersRolesPage() {
  return (
    <Tabs
      items={[
        { key: 'partners', label: 'Brand Partners', children: <PartnersPanel /> },
        { key: 'roles', label: 'Roles', children: <RolesPanel /> },
      ]}
    />
  )
}
```

- [ ] **Step 4: Write the My Profile page (password change only in this task; MFA reset is out of scope for phase 1)**

`src/app/(app)/settings/profile/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Card, Form, Input, Button, Alert, message } from 'antd'

export default function ProfilePage() {
  const [error, setError] = useState<string | null>(null)

  const onFinish = async (values: { newPassword: string }) => {
    setError(null)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Could not update password')
      return
    }
    message.success('Password updated')
  }

  return (
    <Card title="My Profile" style={{ maxWidth: 420 }}>
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="newPassword" label="New password" rules={[{ required: true, min: 8 }]}>
          <Input.Password />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          Update password
        </Button>
      </Form>
    </Card>
  )
}
```

**Note:** this reuses `POST /api/auth/change-password`, which currently requires `session.pendingPartnerId` (Task 8). Before this step works for an already-logged-in partner, adjust that route to also accept a fully-authenticated `session.partnerId` — add this check at the top of `src/app/api/auth/change-password/route.ts`:

```ts
const targetId = session.pendingPartnerId ?? session.partnerId
if (!targetId) {
  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
}
```

and replace the two occurrences of `session.pendingPartnerId` used to look up/update the partner in that file with `targetId`.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, log in as Owner, visit `/settings/partners-roles`: create a role with a couple of permissions checked, invite a partner with that role (note the temporary password shown), deactivate/reactivate a partner. Visit `/settings/profile` and change the password successfully. Confirm a non-Owner partner without `manageRoles`/`managePartners` does not see "Brand Partners & Roles" in the nav (Task 11) and gets `403` if they hit the API routes directly.

- [ ] **Step 6: Commit**

```bash
git add src/components/settings "src/app/(app)/settings" src/app/api/auth/change-password/route.ts
git commit -m "feat: add Settings pages for Brand Partners, Roles, and My Profile"
```

---

### Task 22: Dashboard stats helper (TDD) and API route

**Files:**
- Create: `src/lib/dashboardStats.ts`
- Test: `src/lib/dashboardStats.test.ts`
- Create: `src/app/api/dashboard/stats/route.ts`

**Interfaces:**
- Produces: `computeDashboardCounts(rows: { createdAt: Date }[], now?: Date): { total: number; thisWeek: number; thisMonth: number }`

- [ ] **Step 1: Write the failing test**

`src/lib/dashboardStats.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeDashboardCounts } from './dashboardStats'

describe('computeDashboardCounts', () => {
  const now = new Date('2026-09-03T12:00:00Z') // a Thursday

  it('counts total rows', () => {
    const rows = [{ createdAt: new Date('2026-01-01') }, { createdAt: new Date('2026-09-01') }]
    expect(computeDashboardCounts(rows, now).total).toBe(2)
  })

  it('counts rows within the current calendar week', () => {
    const rows = [
      { createdAt: new Date('2026-09-01T00:00:00Z') }, // Tuesday this week
      { createdAt: new Date('2026-08-20T00:00:00Z') }, // earlier
    ]
    expect(computeDashboardCounts(rows, now).thisWeek).toBe(1)
  })

  it('counts rows within the current calendar month', () => {
    const rows = [
      { createdAt: new Date('2026-09-01T00:00:00Z') },
      { createdAt: new Date('2026-08-31T23:59:59Z') },
    ]
    expect(computeDashboardCounts(rows, now).thisMonth).toBe(1)
  })

  it('returns zeros for an empty list', () => {
    expect(computeDashboardCounts([], now)).toEqual({ total: 0, thisWeek: 0, thisMonth: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dashboardStats.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/dashboardStats.ts`:

```ts
export interface AssessmentDateRow {
  createdAt: Date
}

export interface DashboardCounts {
  total: number
  thisWeek: number
  thisMonth: number
}

export function computeDashboardCounts(
  rows: AssessmentDateRow[],
  now: Date = new Date()
): DashboardCounts {
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  let thisWeek = 0
  let thisMonth = 0
  for (const row of rows) {
    if (row.createdAt >= startOfWeek) thisWeek++
    if (row.createdAt >= startOfMonth) thisMonth++
  }

  return { total: rows.length, thisWeek, thisMonth }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dashboardStats.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the stats API route (reuses the permission-scoped query builder)**

`src/app/api/dashboard/stats/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner, requirePermission } from '@/lib/authz'
import { buildAssessmentWhere } from '@/lib/assessmentQuery'
import { computeDashboardCounts } from '@/lib/dashboardStats'

export async function GET() {
  const partner = await getCurrentPartner()
  if (!partner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const where = buildAssessmentWhere(
    {},
    { currentPartnerId: partner.id, canViewAll: requirePermission(partner, 'viewAllAssessments') }
  )

  const rows = await prisma.assessment.findMany({ where, select: { createdAt: true } })
  const counts = computeDashboardCounts(rows)

  const recent = await prisma.assessment.findMany({
    where,
    include: { handledByPartner: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json({ counts, recent })
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboardStats.ts src/lib/dashboardStats.test.ts src/app/api/dashboard
git commit -m "feat: add dashboard stats calculation and API route"
```

---

### Task 23: Dashboard UI

**Files:**
- Create: `src/components/dashboard/StatCards.tsx`
- Create: `src/components/dashboard/RecentActivityList.tsx`
- Create: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `GET /api/dashboard/stats` (Task 22)

- [ ] **Step 1: Write the stat cards**

`src/components/dashboard/StatCards.tsx`:

```tsx
import { Card, Col, Row, Statistic } from 'antd'

export interface StatCardsProps {
  total: number
  thisWeek: number
  thisMonth: number
}

export function StatCards({ total, thisWeek, thisMonth }: StatCardsProps) {
  return (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={8}>
        <Card>
          <Statistic title="Total Assessments" value={total} />
        </Card>
      </Col>
      <Col xs={24} sm={8}>
        <Card>
          <Statistic title="This Week" value={thisWeek} />
        </Card>
      </Col>
      <Col xs={24} sm={8}>
        <Card>
          <Statistic title="This Month" value={thisMonth} />
        </Card>
      </Col>
    </Row>
  )
}
```

- [ ] **Step 2: Write the recent activity list**

`src/components/dashboard/RecentActivityList.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { Card, List } from 'antd'

export interface RecentAssessment {
  id: string
  name: string
  date: string
  handledByPartner: { name: string }
}

export function RecentActivityList({ items }: { items: RecentAssessment[] }) {
  const router = useRouter()

  return (
    <Card title="Recent Activity">
      <List
        dataSource={items}
        renderItem={(item) => (
          <List.Item
            style={{ cursor: 'pointer' }}
            onClick={() => router.push(`/health-assessment/result/${item.id}`)}
          >
            <List.Item.Meta
              title={item.name}
              description={`${item.date.slice(0, 10)} — handled by ${item.handledByPartner.name}`}
            />
          </List.Item>
        )}
      />
    </Card>
  )
}
```

- [ ] **Step 3: Write the dashboard page**

`src/app/(app)/dashboard/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button, Skeleton } from 'antd'
import { StatCards } from '@/components/dashboard/StatCards'
import { RecentActivityList, type RecentAssessment } from '@/components/dashboard/RecentActivityList'

interface DashboardData {
  counts: { total: number; thisWeek: number; thisMonth: number }
  recent: RecentAssessment[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then(setData)
  }, [])

  if (!data) return <Skeleton active />

  return (
    <div>
      <StatCards {...data.counts} />
      <Link href="/health-assessment/form">
        <Button type="primary" size="large" style={{ marginBottom: 24 }}>
          New Health Assessment
        </Button>
      </Link>
      <RecentActivityList items={data.recent} />
    </div>
  )
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, log in, land on `/dashboard`.
Expected: stat cards show correct counts against the assessments created in earlier tasks; Recent Activity lists them and clicking one navigates to its detail page; "New Health Assessment" navigates to the form. Resize to 375px: the three stat cards stack to full width.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard "src/app/(app)/dashboard"
git commit -m "feat: add Dashboard page with stat cards and recent activity"
```

---

### Task 24: Root redirect and full regression pass

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: nothing new — this task wires the app's entry point and does a final check across every task above.

- [ ] **Step 1: Redirect the root path based on session**

`src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getCurrentPartner } from '@/lib/authz'

export default async function RootPage() {
  const partner = await getCurrentPartner()
  redirect(partner ? '/dashboard' : '/login')
}
```

- [ ] **Step 2: Run the full automated test suite**

Run: `npm test`
Expected: every test file from Tasks 3–6, 10, 12, 15, 19, 22 passes (BMI, permissions, password, authFlow, authz, assessmentSchema, assessmentQuery, export, roleSchema, partnerSchema, roleGuard, dashboardStats).

- [ ] **Step 3: Full manual regression walkthrough**

Run: `npm run dev`. As a fresh browser session:
1. Visit `/` → redirected to `/login`.
2. Log in with the seeded Owner credentials, complete change-password and MFA enroll.
3. Land on `/dashboard`; confirm stat cards and recent activity render.
4. Create a new Health Assessment via the Form; confirm it appears in Results and on the Dashboard.
5. Filter Results by name and by date range; export to Excel and open the file.
6. Open a Result detail page; confirm "Download PDF" is disabled with a tooltip.
7. Visit Measurement; confirm the static ranges render.
8. Hover Skin Analysis in the nav; confirm it's disabled with "Coming soon".
9. In Settings, create a role with only `viewAllAssessments` unchecked, invite a second Brand Partner with that role, log in as them (in an incognito window) using the temporary password shown, and confirm they only see assessments they personally handled in Results and on the Dashboard, and that "Brand Partners & Roles" is absent from their nav.
10. Repeat steps 1–8 at 375px and 768px widths.

Expected: no step above produces a console error, a broken layout, or data leaking across the permission boundary from step 9.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add session-aware root redirect"
```

---

## Deployment Setup (reference, not a coding task)

Once all tasks above pass regression:
1. Create a Supabase project; copy its pooled connection string (`:6543`, `?pgbouncer=true`) into Vercel's `DATABASE_URL` env var, and the direct connection (`:5432`) into a local `.env` for development.
2. Set `SESSION_SECRET` (32+ random characters) in both Vercel and local `.env`.
3. Run `npx prisma db push && npx prisma db seed` once against the Supabase database to create tables and the initial Owner account, then immediately log in and change that seeded password.
4. Connect the repository to Vercel; the existing `npm run build` script (`prisma generate && next build`) requires no additional Vercel configuration.

---

## Plan amendment — 2026-09-03 (after Task 14 checkpoint)

The project owner reviewed a Dashboard design mockup and confirmed the following. These
decisions are binding on all remaining tasks:

- The mockup is **visual direction only**. Sections it showed that were never specced —
  Appointments, Reports, Resources — are **out of scope** and must not be built.
- **No `Client` entity.** Client identity stays denormalized as `name` / `contactNumber` /
  `email` on `Assessment`. The owner explicitly declined a Client model.
- **Skin Analysis remains phase 2** — disabled, "Coming soon", no route or schema.
- **No health score.** No composite `78/100` value and no Good/Average/Needs Attention
  badge. Show raw measurements; an out-of-range flag may derive from Task 18's
  `MEASUREMENT_RANGES`, but nothing may invent clinical judgement.
- Navigation hierarchy, data model, auth, permissions and the assessment form are
  **unchanged** — no structural refactor is required.

**New Task 14A (brand theme and app-shell restyle)** is inserted between Task 14 and
Task 15, so the remaining pages are built in the new visual language instead of being
restyled afterwards. Its brief lives at
`.superpowers/sdd/2026-09-03-community-wellness-point-mvp/task-14A-brief.md`.

Tasks 15-24 are otherwise unchanged, with one addition: each page task should use the
brand tokens from `src/lib/theme.ts` and card-based surfaces consistent with Task 14A.
