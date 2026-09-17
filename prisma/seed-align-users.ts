import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find your main team project
  const project = await prisma.project.findFirst()
  if (!project) return

  // Align all existing users without a default project to this board
  await prisma.user.updateMany({
    where: { defaultProjectId: null, systemRole: 'USER' },
    data: { defaultProjectId: project.id },
  })

  console.log(`Aligned all non-admin users to Project: ${project.name} (${project.id})`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())