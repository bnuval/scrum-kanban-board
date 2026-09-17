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

/**
 * Super Admin: Create Organization
 */
export async function createOrganizationAction(name: string, slug: string) {
  const session = await getSession()
  if (!session || session.systemRole !== 'SUPER_ADMIN') {
    return { success: false, error: 'Unauthorized. Super Admin access required.' }
  }

  try {
    const org = await prisma.organization.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
      },
    })
    revalidatePath('/admin')
    return { success: true, org }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create organization' }
  }
}

/**
 * Super Admin: Provision Org Admin (SM / Project Manager)
 * RULE: No one is allowed to create another SUPER_ADMIN.
 */
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
    const hash = await bcrypt.hash(data.password, 10)

    const user = await prisma.user.create({
      data: {
        username: data.username.trim(),
        email: data.email.trim().toLowerCase(),
        passwordHash: hash,
        name: data.name.trim(),
        systemRole: SystemRole.USER, // STRICT: Always USER, never SUPER_ADMIN
      },
    })

    await prisma.orgMember.create({
      data: {
        userId: user.id,
        organizationId: data.organizationId,
        role: OrgRole.ORG_ADMIN, // Assigned as the Org Lead / SM
      },
    })

    revalidatePath('/admin')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to provision Organization Admin' }
  }
}

/**
 * Org Admin (SM / PM): Provision team members inside their own Organization (PO, SM, DEV, QA)
 */
export async function provisionTeamMemberAction(data: {
  username: string
  email: string
  password: string
  name: string
  role: 'PO' | 'SM' | 'DEV' | 'QA'
}) {
  const session = await getSession()
  if (!session || !session.orgId || session.orgRole !== 'ORG_ADMIN') {
    return { success: false, error: 'Unauthorized. Only Organization Admins can provision team members.' }
  }

  try {
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
        organizationId: session.orgId,
        role: data.role as OrgRole,
      },
    })

    revalidatePath('/')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to provision team member' }
  }
}

/**
 * Org Admin (SM / PM): Create a new Board / Project for their Organization
 */
export async function createProjectBoardAction(name: string, key: string) {
  const session = await getSession()
  if (!session || !session.orgId || (session.orgRole !== 'ORG_ADMIN' && session.systemRole !== 'SUPER_ADMIN')) {
    return { success: false, error: 'Unauthorized. Only Organization Admins can create boards.' }
  }

  try {
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        key: key.trim().toUpperCase(),
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
    return { success: false, error: err.message || 'Failed to create board' }
  }
}