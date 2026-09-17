'use server'

import { prisma } from '@/lib/prisma'
import { createSession, logout } from '@/lib/auth'
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

export async function createUserWithRoleAction(data: {
  username: string
  email: string
  password: string
  name: string
  systemRole: SystemRole
  organizationId?: string
  orgRole?: OrgRole
}) {
  try {
    const hash = await bcrypt.hash(data.password, 10)

    const user = await prisma.user.create({
      data: {
        username: data.username.trim(),
        email: data.email.trim().toLowerCase(),
        passwordHash: hash,
        name: data.name.trim(),
        systemRole: data.systemRole,
      },
    })

    if (data.organizationId && data.orgRole) {
      await prisma.orgMember.create({
        data: {
          userId: user.id,
          organizationId: data.organizationId,
          role: data.orgRole,
        },
      })
    }

    revalidatePath('/admin')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create user' }
  }
}