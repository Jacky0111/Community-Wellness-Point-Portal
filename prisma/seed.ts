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
