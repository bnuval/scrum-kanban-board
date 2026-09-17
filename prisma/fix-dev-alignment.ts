import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.project.findMany()
  if (projects.length === 0) {
    console.log('No projects found.')
    return
  }

  const users = await prisma.user.findMany({
    where: { systemRole: 'USER' },
    include: { projectMembers: true },
  })

  for (const user of users) {
    // If user has no defaultProjectId, assign them to the first project
    const targetProjectId = user.defaultProjectId || projects[0].id

    await prisma.user.update({
      where: { id: user.id },
      data: { defaultProjectId: targetProjectId },
    })

    // Also link in ProjectMember table
    const exists = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId: targetProjectId,
        },
      },
    })

    if (!exists) {
      await prisma.projectMember.create({
        data: {
          userId: user.id,
          projectId: targetProjectId,
        },
      })
    }

    console.log(`Aligned user "${user.username}" to Project ID: ${targetProjectId}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())