'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { IssuePriority, IssueType, LinkType } from '@prisma/client'

/**
 * Helper: Validates if the active session user has write access to an issue's project.
 */
async function verifyWritePermission(issueId: string) {
  const session = await getSession()
  if (!session) return { allowed: false, error: 'Unauthorized. Please sign in.' }

  // Super Admin & Org Admin have global write access
  if (session.systemRole === 'SUPER_ADMIN' || session.orgRole === 'ORG_ADMIN') {
    return { allowed: true }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { defaultProjectId: true },
  })

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { projectId: true },
  })

  if (!issue) return { allowed: false, error: 'Issue not found.' }

  // Dev, QA, PO, SM can only write to their default primary team project
  if (user?.defaultProjectId !== issue.projectId) {
    return { allowed: false, error: 'Read-only mode. You cannot modify tickets on other team boards.' }
  }

  return { allowed: true }
}

/**
 * Update Issue Position (Protected against cross-team edits)
 */
export async function updateIssuePosition(
  issueId: string,
  newColumnId: string,
  newOrder: number,
  newParentId?: string | null
) {
  const check = await verifyWritePermission(issueId)
  if (!check.allowed) return { success: false, error: check.error }

  try {
    const updateData: any = {
      columnId: newColumnId,
      order: newOrder,
    }

    if (newParentId !== undefined) {
      updateData.parentId = newParentId
    }

    await prisma.issue.update({
      where: { id: issueId },
      data: updateData,
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to update issue position:', error)
    return { success: false, error: 'Database update failed' }
  }
}

/**
 * Assign Sprint / Iteration Path (Blocked on foreign boards)
 */
export async function assignIssueSprint(issueId: string, sprintId: string | null) {
  const check = await verifyWritePermission(issueId)
  if (!check.allowed) return { success: false, error: check.error }

  try {
    await prisma.issue.update({
      where: { id: issueId },
      data: { sprintId: sprintId || null },
    })
    return { success: true }
  } catch (error) {
    console.error('Failed to assign sprint:', error)
    return { success: false, error: 'Database update failed' }
  }
}

/**
 * Update Issue Parent (Blocked on foreign boards)
 */
export async function updateIssueParent(issueId: string, parentId: string | null) {
  const check = await verifyWritePermission(issueId)
  if (!check.allowed) return { success: false, error: check.error }

  try {
    await prisma.issue.update({
      where: { id: issueId },
      data: { parentId: parentId || null },
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update parent' }
  }
}

/**
 * Update Issue Details in Drawer (Blocked on foreign boards)
 */
export async function updateIssueDetails(formData: {
  issueId: string
  title: string
  description?: string
  priority: IssuePriority
  columnId: string
  storyPoints?: number | null
  assigneeId?: string | null
}) {
  const check = await verifyWritePermission(formData.issueId)
  if (!check.allowed) return { success: false, error: check.error }

  try {
    await prisma.issue.update({
      where: { id: formData.issueId },
      data: {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        columnId: formData.columnId,
        storyPoints: formData.storyPoints,
        assigneeId: formData.assigneeId,
      },
    })
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to update issue:', error)
    return { success: false, error: 'Failed to update issue' }
  }
}

/**
 * Commenting: Intentionally allowed for cross-team participation
 */
export async function addComment(issueId: string, body: string) {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: 'Unauthorized' }

    await prisma.comment.create({
      data: {
        body,
        issueId,
        userId: session.userId,
      },
    })
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to add comment:', error)
    return { success: false, error: 'Failed to add comment' }
  }
}