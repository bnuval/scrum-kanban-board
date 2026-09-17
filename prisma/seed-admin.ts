import { PrismaClient, SystemRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('Admin@12345', 10)

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@scrumsuite.com',
      passwordHash,
      name: 'Root Super Admin',
      systemRole: SystemRole.SUPER_ADMIN,
    },
  })

  console.log('Super Admin successfully seeded: admin / Admin@12345')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })