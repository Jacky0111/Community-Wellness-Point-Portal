import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => import('@/test/sessionMock'))

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resetDb, createRole, createPartner } from '@/test/db'
import { clearSession } from '@/test/sessionMock'
import { POST } from '@/app/api/auth/login/route'

beforeEach(async () => {
  await resetDb()
  clearSession()
})

function login(email: string, password: string) {
  return POST(
    new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'content-type': 'application/json' },
    })
  )
}

describe('rate limiting on /api/auth/login', () => {
  it('an unknown email returns 401 every time, never 429', async () => {
    for (let i = 0; i < 8; i++) {
      const res = await login('nobody@example.com', 'whatever')
      expect(res.status).toBe(401)
    }
  })

  it('5 failed attempts lock the account, and the 6th attempt returns 429', async () => {
    const role = await createRole()
    const partner = await createPartner({ roleId: role.id, email: 'lockme@example.com', password: 'correct-password' })

    for (let i = 0; i < 5; i++) {
      const res = await login(partner.email, 'wrong-password')
      expect(res.status).toBe(401)
    }

    const sixth = await login(partner.email, 'wrong-password')
    expect(sixth.status).toBe(429)
  })

  it('a locked account cannot promote its session even with the correct password', async () => {
    const role = await createRole()
    const partner = await createPartner({ roleId: role.id, email: 'locked2@example.com', password: 'correct-password' })

    for (let i = 0; i < 5; i++) {
      await login(partner.email, 'wrong-password')
    }

    const res = await login(partner.email, 'correct-password')
    expect(res.status).toBe(429)
  })

  it('a correct password before any lockout succeeds', async () => {
    const role = await createRole()
    const partner = await createPartner({ roleId: role.id, email: 'gooduser@example.com', password: 'correct-password' })

    const res = await login(partner.email, 'correct-password')
    expect(res.status).toBe(200)
  })

  it('a deactivated partner cannot log in even with the correct password', async () => {
    const role = await createRole()
    const partner = await createPartner({
      roleId: role.id,
      email: 'inactive@example.com',
      password: 'correct-password',
      isActive: false,
    })

    const res = await login(partner.email, 'correct-password')
    expect(res.status).toBe(401)
  })

  it('does not touch other partners rows while locking one out', async () => {
    const role = await createRole()
    const partner = await createPartner({ roleId: role.id, email: 'a@example.com', password: 'correct-password' })
    const other = await createPartner({ roleId: role.id, email: 'b@example.com', password: 'correct-password' })

    for (let i = 0; i < 5; i++) {
      await login(partner.email, 'wrong-password')
    }

    const untouched = await prisma.brandPartner.findUniqueOrThrow({ where: { id: other.id } })
    expect(untouched.failedPasswordAttempts).toBe(0)
    expect(untouched.passwordLockedUntil).toBeNull()
  })
})
