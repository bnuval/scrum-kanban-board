import { PrismaClient, SystemRole, IssueType, IssuePriority, SprintStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with default Scrum project...')

  // 1. Ensure Root Super Admin exists
  const passwordHash = await bcrypt.hash('Admin@12345', 10)
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@scrumsuite.com',
      passwordHash,
      name: 'Super Admin',
      systemRole: SystemRole.SUPER_ADMIN,
    },
  })

  // 2. Create Default Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'default-org' },
    update: {},
    create: {
      name: 'Default Organization',
      slug: 'default-org',
    },
  })

  // 3. Link Admin to Organization as ORG_ADMIN
  await prisma.orgMember.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: org.id,
      role: 'ORG_ADMIN',
    },
  })

  // 4. Create or update the default SCRUM project
  const project = await prisma.project.upsert({
    where: { key: 'SCRUM' },
    update: {
      organizationId: org.id,
    },
    create: {
      key: 'SCRUM',
      name: 'Core Platform Delivery',
      organizationId: org.id,
    },
  })

  // 5. Add default Kanban Columns
  const defaultColumns = [
    { name: 'To Do', order: 0 },
    { name: 'In Progress', order: 1 },
    { name: 'Testing', order: 2 },
    { name: 'Done', order: 3 },
  ]

  for (const col of defaultColumns) {
    const existing = await prisma.column.findFirst({
      where: { projectId: project.id, name: col.name },
    })
    if (!existing) {
      await prisma.column.create({
        data: {
          name: col.name,
          order: col.order,
          projectId: project.id,
        },
      })
    }
  }

  // 6. Create an Active Sprint
  const existingSprint = await prisma.sprint.findFirst({
    where: { projectId: project.id, status: SprintStatus.ACTIVE },
  })

  let activeSprint = existingSprint
  if (!activeSprint) {
    activeSprint = await prisma.sprint.create({
      data: {
        name: 'Sprint 1',
        status: SprintStatus.ACTIVE,
        projectId: project.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    })
  }

  // 7. Seed sample Starter Epics and Stories
  const todoCol = await prisma.column.findFirst({
    where: { projectId: project.id, name: 'To Do' },
  })

  const existingIssue = await prisma.issue.findFirst({
    where: { projectId: project.id },
  })

  if (!existingIssue && todoCol) {
    // Epic
    const epic = await prisma.issue.create({
      data: {
        key: `${project.key}-1`,
        title: 'Authentication & Multi-Tenant Access',
        description: 'Set up system-wide RBAC, super admin controls, and team swimlanes.',
        type: IssueType.EPIC,
        priority: IssuePriority.HIGH,
        order: 1.0,
        projectId: project.id,
        columnId: todoCol.id,
        sprintId: activeSprint.id,
        reporterId: adminUser.id,
        assigneeId: adminUser.id,
      },
    })

    // Story under Epic
    const story = await prisma.issue.create({
      data: {
        key: `${project.key}-2`,
        title: 'User Login & Session Management',
        description: 'Implement secure JWT cookie session flow for members.',
        type: IssueType.STORY,
        priority: IssuePriority.HIGHEST,
        order: 2.0,
        storyPoints: 5,
        projectId: project.id,
        columnId: todoCol.id,
        parentId: epic.id,
        sprintId: activeSprint.id,
        reporterId: adminUser.id,
        assigneeId: adminUser.id,
      },
    })

    // Task under Story
    await prisma.issue.create({
      data: {
        key: `${project.key}-3`,
        title: 'Configure jose JWT middleware & cookie encryption',
        type: IssueType.TASK,
        priority: IssuePriority.MEDIUM,
        order: 3.0,
        storyPoints: 3,
        projectId: project.id,
        columnId: todoCol.id,
        parentId: story.id,
        sprintId: activeSprint.id,
        reporterId: adminUser.id,
        assigneeId: adminUser.id,
      },
    })
  }

  console.log('Project setup complete. Project Key: SCRUM')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })