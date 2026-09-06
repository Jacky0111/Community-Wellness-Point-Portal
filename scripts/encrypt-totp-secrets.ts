/**
 * One-off migration: encrypts any BrandPartner.totpSecretEnc values that are
 * still stored as legacy plaintext base32 secrets.
 *
 * Idempotent — rows already in the `v1:` encrypted format are skipped, so
 * running this script twice will not double-encrypt anything.
 *
 * Usage: npx tsx scripts/encrypt-totp-secrets.ts
 */
import { prisma } from '../src/lib/prisma'
import { encryptSecret, isEncrypted } from '../src/lib/crypto'

async function main() {
  const partners = await prisma.brandPartner.findMany({
    where: { totpSecretEnc: { not: null } },
    select: { id: true, totpSecretEnc: true },
  })

  let migrated = 0

  for (const partner of partners) {
    const secret = partner.totpSecretEnc
    if (!secret || isEncrypted(secret)) {
      continue
    }

    await prisma.brandPartner.update({
      where: { id: partner.id },
      data: { totpSecretEnc: encryptSecret(secret) },
    })
    migrated++
  }

  console.log(`Migrated ${migrated} of ${partners.length} BrandPartner row(s) with a totpSecretEnc.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
