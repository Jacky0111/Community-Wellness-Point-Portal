import { Prisma } from '@prisma/client'

// Explicit select: never return passwordHash, totpSecretEnc, or other secret
// fields to the client. Prisma's default `include: { role: true }` would
// return every scalar column on BrandPartner, which includes the password
// hash and encrypted TOTP secret — those must never leave the server.
//
// Any new secret field added to the BrandPartner model (another credential,
// another encrypted value, etc.) must be excluded here too — this is the
// single place both partner routes select from, so omitting it here keeps it
// out of every response.
export const PARTNER_SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  mustChangePassword: true,
  totpEnabledAt: true,
  isActive: true,
  roleId: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BrandPartnerSelect
