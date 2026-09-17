'use server'

import { prisma } from '@/lib/prisma'
import { createSession, logout, getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { OrgRole, SystemRole } from '@prisma/client'

export async function loginAction(formData: { usernameOrEmail: string; password: string }) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: formData.usernameOrEmail.trim() },
          { email: formData.usernameOrEmail.trim().toLowerCase() },
        ],
      },
      include: {
        orgMemberships: {
          include: { organization: true },
          take: 1,
        },
      },
    })

    if (!user) {
      return { success: false, error: 'Invalid username or password' }
    }

    const isValid = await bcrypt.compare(formData.password, user.passwordHash)
    if (!isValid) {
      return { success: false, error: 'Invalid username or password' }
    }

    const primaryMembership = user.orgMemberships[0]

    await createSession({
      userId: user.id,
      username: user.username,
      name: user.name,
      systemRole: user.systemRole,
      orgId: primaryMembership?.organizationId,
      orgRole: primaryMembership?.role,
    })

    return {
      success: true,
      systemRole: user.systemRole,
      orgRole: primaryMembership?.role,
    }
  } catch (error: any) {
    console.error('Login error:', error)
    return { success: false, error: error.message || 'Authentication failed' }
  }
}

export async function logoutAction() {
  await logout()
}

export async function createOrganizationAction(name: string, slug: string) {
  const session = await getSession()
  if (!session || session.systemRole !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized. Super Admin access required.' }
  }

  try {
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: slug.trim().toLowerCase() },
    })

    if (existingOrg) {
      return { success: false, error: 'An organization with this slug already exists.' }
    }

    const org = await prisma.organization.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
      },
    })

    revalidatePath('/admin')
    return { success: true, org }
  } catch (err: any) {
    console.error('Create organization error:', err)
    return { success: false, error: err.message || 'Failed to create organization' }
  }
}

export async function provisionOrgAdminAction(data: {
  username: string
  email: string
  password: string
  name: string
  organizationId: string
}) {
  const session = await getSession()
  if (!session || session.systemRole !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized. Super Admin access required.' }
  }

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username.trim() },
          { email: data.email.trim().toLowerCase() },
        ],
      },
    })

    if (existing) {
      return { success: false, error: 'A user with this username or email already exists.' }
    }

    const hash = await bcrypt.hash(data.password, 10)

    const user = await prisma.user.create({
      data: {
        username: data.username.trim(),
        email: data.email.trim().toLowerCase(),
        passwordHash: hash,
        name: data.name.trim(),
        systemRole: SystemRole.USER,
      },
    })

    await prisma.orgMember.create({
      data: {
        userId: user.id,
        organizationId: data.organizationId,
        role: OrgRole.ORG_ADMIN,
      },
    })

    revalidatePath('/admin')
    return { success: true }
  } catch (err: any) {
    console.error('Provisioning Org Admin error:', err)
    return { success: false, error: err.message || 'Failed to provision Organization Admin' }
  }
}

export async function provisionTeamMemberAction(data: {
  username: string
  email: string
  password: string
  name: string
  role: 'PO' | 'SM' | 'DEV' | 'QA'
  projectId: string
}) {
  const session = await getSession()
  if (!session || !session.orgId || session.orgRole !== 'ORG_ADMIN') {
    return { success: false, error: 'Unauthorized. Only Organization Admins can provision team members.' }
  }

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username.trim() },
          { email: data.email.trim().toLowerCase() },
        ],
      },
    })

    if (existing) {
      return { success: false, error: 'A user with this username or email already exists.' }
    }

    const hash = await bcrypt.hash(data.password, 10)

    const user = await prisma.user.create({
      data: {
        username: data.username.trim(),
        email: data.email.trim().toLowerCase(),
        passwordHash: hash,
        name: data.name.trim(),
        systemRole: SystemRole.USER,
        defaultProjectId: data.projectId,
      },
    })

    await prisma.orgMember.create({
      data: {
        userId: user.id,
        organizationId: session.orgId,
        role: data.role as OrgRole,
      },
    })

    await prisma.projectMember.create({
      data: {
        userId: user.id,
        projectId: data.projectId,
      },
    })

    revalidatePath('/')
    return { success: true }
  } catch (err: any) {
    console.error('Provisioning team member error:', err)
    return { success: false, error: err.message || 'Failed to provision team member' }
  }
}

export async function createProjectBoardAction(name: string, key: string) {
  const session = await getSession()
  if (!session || !session.orgId || (session.orgRole !== 'ORG_ADMIN' && session.systemRole !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized. Only Organization Admins can create boards.' }
  }

  try {
    const cleanKey = key.trim().toUpperCase()

    const existingProject = await prisma.project.findUnique({
      where: { key: cleanKey },
    })

    if (existingProject) {
      return { success: false, error: `A project with key "${cleanKey}" already exists.` }
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        key: cleanKey,
        organizationId: session.orgId,
        columns: {
          create: [
            { name: 'To Do', order: 0 },
            { name: 'In Progress', order: 1 },
            { name: 'Testing', order: 2 },
            { name: 'Done', order: 3 },
          ],
        },
        sprints: {
          create: {
            name: 'Sprint 1',
            status: 'ACTIVE',
            startDate: new Date(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        },
      },
    })

    revalidatePath('/')
    return { success: true, project }
  } catch (err: any) {
    console.error('Create project board error:', err)
    return { success: false, error: err.message || 'Failed to create board' }
  }
}