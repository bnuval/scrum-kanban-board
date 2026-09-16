import { PrismaClient, IssueType, IssuePriority, SprintStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Scrum project...')

  // 1. Create or get default user
  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
    },
  })

  // 2. Create or update the project
  const project = await prisma.project.upsert({
    where: { key: 'SCRUM' },
    update: {},
    create: {
      key: 'SCRUM',
      name: 'Scrum Sprint Board',
      description: 'Main project development board',
    },
  })

  // 3. Create Project Columns
  const columnData = [
    { name: 'To Do', order: 1 },
    { name: 'In Progress', order: 2 },
    { name: 'Done', order: 3 },
    { name: 'Cancelled', order: 4 },
  ]

  const columns = []
  for (const col of columnData) {
    const createdCol = await prisma.column.upsert({
      where: {
        projectId_name: {
          projectId: project.id,
          name: col.name,
        },
      },
      update: { order: col.order },
      create: {
        name: col.name,
        order: col.order,
        projectId: project.id,
      },
    })
    columns.push(createdCol)
  }

  // 4. Create Active Sprint
  const sprint = await prisma.sprint.create({
    data: {
      name: 'Sprint 1',
      status: SprintStatus.ACTIVE,
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days out
      projectId: project.id,
    },
  })

  // 5. Create initial issues
  const todoCol = columns.find((c) => c.name === 'To Do')!
  const inProgressCol = columns.find((c) => c.name === 'In Progress')!
  const doneCol = columns.find((c) => c.name === 'Done')!

  const sampleIssues = [
    {
      title: 'Setup Supabase and Prisma schema',
      description: 'Configure database connection strings and run initial migrations.',
      type: IssueType.TASK,
      priority: IssuePriority.HIGH,
      order: 1.0,
      storyPoints: 3,
      columnId: doneCol.id,
    },
    {
      title: 'Build drag-and-drop Kanban board',
      description: 'Implement optimistic state management with @hello-pangea/dnd.',
      type: IssueType.STORY,
      priority: IssuePriority.HIGHEST,
      order: 1.0,
      storyPoints: 5,
      columnId: inProgressCol.id,
    },
    {
      title: 'Implement manual save and issue drawer',
      description: 'Allow status changes, story point estimation, and comments.',
      type: IssueType.TASK,
      priority: IssuePriority.MEDIUM,
      order: 1.0,
      storyPoints: 2,
      columnId: todoCol.id,
    },
  ]

  for (let i = 0; i < sampleIssues.length; i++) {
    const item = sampleIssues[i]
    await prisma.$transaction(async (tx) => {
      const created = await tx.issue.create({
        data: {
          key: `TEMP-${Date.now()}-${i}`,
          title: item.title,
          description: item.description,
          type: item.type,
          priority: item.priority,
          order: item.order,
          storyPoints: item.storyPoints,
          projectId: project.id,
          columnId: item.columnId,
          sprintId: sprint.id,
          assigneeId: user.id,
          reporterId: user.id,
        },
      })

      await tx.issue.update({
        where: { id: created.id },
        data: { key: `${project.key}-${created.number}` },
      })
    })
  }

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })