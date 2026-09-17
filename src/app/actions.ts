'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { IssuePriority, IssueType, LinkType } from '@prisma/client'

const ALLOWED_CHILD_TYPES: Record<IssueType, IssueType[]> = {
  EPIC: [IssueType.FEATURE, IssueType.STORY, IssueType.BUG],
  FEATURE: [IssueType.STORY, IssueType.BUG],
  STORY: [IssueType.TASK, IssueType.BUG],
  BUG: [IssueType.TASK],
  TASK: [],
}

/**
 * Fast issue position update. UI updates optimistically; no blocking page revalidation.
 */
export async function updateIssuePosition(
  issueId: string,
  newColumnId: string,
  newOrder: number,
  newParentId?: string | null
) {
  try {
    const updateData: any = {
      columnId: newColumnId,
      order: newOrder,
    }

    if (newParentId !== undefined) {
      updateData.parentId = newParentId
    }

    const updatedIssue = await prisma.issue.update({
      where: { id: issueId },
      data: updateData,
      include: {
        parent: {
          include: {
            children: {
              select: { id: true, columnId: true },
            },
          },
        },
      },
    })

    // Cascading parent story auto-completion
    if (updatedIssue.parent && updatedIssue.parent.children.length > 0) {
      const parent = updatedIssue.parent
      const allSiblings = parent.children

      const doneCol = await prisma.column.findFirst({
        where: { projectId: parent.projectId, name: { equals: 'Done', mode: 'insensitive' } },
        select: { id: true },
      })
      const inProgressCol = await prisma.column.findFirst({
        where: { projectId: parent.projectId, name: { equals: 'In Progress', mode: 'insensitive' } },
        select: { id: true },
      })

      if (doneCol) {
        const allCompleted = allSiblings.every((child) =>
          child.id === issueId ? newColumnId === doneCol.id : child.columnId === doneCol.id
        )

        if (allCompleted && parent.columnId !== doneCol.id) {
          await prisma.issue.update({
            where: { id: parent.id },
            data: { columnId: doneCol.id },
          })
        } else if (!allCompleted && inProgressCol && parent.columnId === doneCol.id) {
          await prisma.issue.update({
            where: { id: parent.id },
            data: { columnId: inProgressCol.id },
          })
        }
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to update issue position:', error)
    return { success: false, error: 'Database update failed' }
  }
}

/**
 * Re-parent an issue (Story -> Feature, Bug -> Story, etc.)
 */
export async function updateIssueParent(issueId: string, parentId: string | null) {
  try {
    if (parentId) {
      const parent = await prisma.issue.findUnique({
        where: { id: parentId },
        select: { id: true, type: true },
      })
      const child = await prisma.issue.findUnique({
        where: { id: issueId },
        select: { id: true, type: true },
      })

      if (!parent || !child) throw new Error('Issue not found')
      if (parent.id === child.id) throw new Error('Cannot parent an issue to itself')

      const allowed = ALLOWED_CHILD_TYPES[parent.type]
      if (!allowed || !allowed.includes(child.type)) {
        throw new Error(`Cannot assign a ${child.type} under a ${parent.type}`)
      }
    }

    await prisma.issue.update({
      where: { id: issueId },
      data: { parentId: parentId || null },
    })

    return { success: true }
  } catch (error: any) {
    console.error('Failed to update parent:', error)
    return { success: false, error: error.message || 'Failed to update parent' }
  }
}

/**
 * Fast subtask completion toggle without full-page revalidation.
 */
export async function toggleSubtaskCompletion(subtaskId: string, isCompleted: boolean) {
  try {
    await prisma.issue.update({
      where: { id: subtaskId },
      data: { isCompleted },
    })
    return { success: true }
  } catch (error) {
    console.error('Failed to toggle completion:', error)
    return { success: false, error: 'Failed to update issue' }
  }
}

export async function assignIssueSprint(issueId: string, sprintId: string | null) {
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

export async function updateIssueDetails(formData: {
  issueId: string
  title: string
  description?: string
  priority: IssuePriority
  columnId: string
  storyPoints?: number | null
  assigneeId?: string | null
  parentId?: string | null
  sprintId?: string | null
}) {
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
        parentId: formData.parentId !== undefined ? formData.parentId : undefined,
        sprintId: formData.sprintId !== undefined ? formData.sprintId : undefined,
      },
    })
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to update issue:', error)
    return { success: false, error: 'Failed to update issue' }
  }
}

export async function createIssue(formData: {
  title: string
  description?: string
  type: IssueType
  priority: IssuePriority
  columnId: string
  projectId: string
  storyPoints?: number | null
  assigneeId?: string | null
  parentId?: string | null
  sprintId?: string | null
}) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: formData.projectId },
      include: { sprints: { where: { status: 'ACTIVE' }, take: 1 } },
    })

    if (!project) throw new Error('Project not found')
    const user = await prisma.user.findFirst()

    await prisma.$transaction(async (tx) => {
      const tempKey = `TEMP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

      const created = await tx.issue.create({
        data: {
          key: tempKey,
          title: formData.title,
          description: formData.description,
          type: formData.type,
          priority: formData.priority,
          order: 9999.0,
          storyPoints: formData.storyPoints ?? null,
          projectId: formData.projectId,
          columnId: formData.columnId,
          parentId: formData.parentId ?? null,
          sprintId: formData.sprintId !== undefined ? formData.sprintId : (project.sprints[0]?.id ?? null),
          reporterId: user?.id ?? null,
          assigneeId: formData.assigneeId ?? user?.id ?? null,
        },
      })

      const formattedKey = `${project.key}-${created.number}`
      await tx.issue.update({
        where: { id: created.id },
        data: { key: formattedKey },
      })
    })

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to create issue:', error)
    return { success: false, error: 'Database creation failed' }
  }
}

export async function createChildIssue(formData: {
  parentId: string
  title: string
  childType: IssueType
}) {
  try {
    const parent = await prisma.issue.findUnique({
      where: { id: formData.parentId },
      include: { project: true },
    })

    if (!parent) throw new Error('Parent issue not found')

    const allowed = ALLOWED_CHILD_TYPES[parent.type]
    if (!allowed || !allowed.includes(formData.childType)) {
      throw new Error(`Cannot create a ${formData.childType} under a ${parent.type}`)
    }

    const user = await prisma.user.findFirst()

    const created = await prisma.$transaction(async (tx) => {
      const tempKey = `TEMP-CHILD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

      const newIssue = await tx.issue.create({
        data: {
          key: tempKey,
          title: formData.title,
          type: formData.childType,
          priority: parent.priority,
          order: 9999.0,
          projectId: parent.projectId,
          columnId: parent.columnId,
          sprintId: parent.sprintId,
          parentId: parent.id,
          reporterId: user?.id ?? null,
          assigneeId: parent.assigneeId ?? null,
        },
      })

      const formattedKey = `${parent.project.key}-${newIssue.number}`
      return await tx.issue.update({
        where: { id: newIssue.id },
        data: { key: formattedKey },
        include: { assignee: true },
      })
    })

    revalidatePath('/')
    return { success: true, issue: created }
  } catch (error: any) {
    console.error('Child creation error:', error)
    return { success: false, error: error.message || 'Failed to create child issue' }
  }
}

export async function syncIssueLinks(
  sourceId: string,
  targetKeysToAdd: string[],
  linkIdsToRemove: string[]
) {
  try {
    if (linkIdsToRemove.length > 0) {
      await prisma.issueLink.deleteMany({
        where: { id: { in: linkIdsToRemove } },
      })
    }

    for (const key of targetKeysToAdd) {
      const target = await prisma.issue.findUnique({
        where: { key: key.trim().toUpperCase() },
      })

      if (!target || target.id === sourceId) continue

      const exists = await prisma.issueLink.findFirst({
        where: {
          OR: [
            { sourceId, targetId: target.id },
            { sourceId: target.id, targetId: sourceId },
          ],
        },
      })

      if (!exists) {
        await prisma.issueLink.create({
          data: {
            sourceId,
            targetId: target.id,
            type: LinkType.RELATES_TO,
          },
        })
      }
    }

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to sync issue links:', error)
    return { success: false, error: 'Failed to update links' }
  }
}

export async function linkIssues(
  sourceId: string,
  targetKey: string,
  type: LinkType = LinkType.RELATES_TO
) {
  try {
    const target = await prisma.issue.findUnique({
      where: { key: targetKey.trim().toUpperCase() },
      include: { assignee: true },
    })

    if (!target) return { success: false, error: `Issue "${targetKey}" not found` }
    if (sourceId === target.id) return { success: false, error: 'Cannot link an issue to itself' }

    const existing = await prisma.issueLink.findFirst({
      where: {
        OR: [
          { sourceId, targetId: target.id },
          { sourceId: target.id, targetId: sourceId },
        ],
      },
    })

    if (existing) {
      return { success: false, error: 'These issues are already linked' }
    }

    const createdLink = await prisma.issueLink.create({
      data: { sourceId, targetId: target.id, type },
      include: {
        target: {
          select: { id: true, key: true, title: true, type: true, isCompleted: true },
        },
      },
    })

    revalidatePath('/')
    return { success: true, link: createdLink }
  } catch (error) {
    console.error('Link issues error:', error)
    return { success: false, error: 'Failed to link issues' }
  }
}

export async function removeIssueLink(linkId: string) {
  try {
    await prisma.issueLink.delete({ where: { id: linkId } })
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to remove link' }
  }
}

export async function deleteIssue(issueId: string) {
  try {
    await prisma.comment.deleteMany({ where: { issueId } })
    await prisma.issue.delete({ where: { id: issueId } })
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete issue:', error)
    return { success: false, error: 'Database deletion failed' }
  }
}

export async function addComment(issueId: string, body: string) {
  try {
    const user = await prisma.user.findFirst()
    if (!user) throw new Error('User not found')

    await prisma.comment.create({
      data: { body, issueId, userId: user.id },
    })
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to add comment:', error)
    return { success: false, error: 'Failed to add comment' }
  }
}

export async function completeSprint(sprintId: string, rollOverSprintId?: string | null) {
  try {
    const currentSprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { project: true },
    })

    if (!currentSprint) throw new Error('Sprint not found')

    const doneCol = await prisma.column.findFirst({
      where: { projectId: currentSprint.projectId, name: { equals: 'Done', mode: 'insensitive' } },
    })

    if (doneCol) {
      await prisma.issue.updateMany({
        where: {
          sprintId,
          columnId: { not: doneCol.id },
        },
        data: {
          sprintId: rollOverSprintId || null,
        },
      })
    }

    await prisma.sprint.update({
      where: { id: sprintId },
      data: { status: 'COMPLETED' },
    })

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to complete sprint:', error)
    return { success: false, error: 'Database update failed' }
  }
}

export async function createSprint(projectId: string, name: string) {
  try {
    const sprintCount = await prisma.sprint.count({ where: { projectId } })
    await prisma.sprint.create({
      data: {
        name: name || `Sprint ${sprintCount + 1}`,
        status: 'PLANNED',
        projectId,
      },
    })
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to create sprint:', error)
    return { success: false, error: 'Database creation failed' }
  }
}

export async function startSprint(sprintId: string) {
  try {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } })
    if (!sprint) throw new Error('Sprint not found')

    await prisma.sprint.updateMany({
      where: { projectId: sprint.projectId, status: 'ACTIVE' },
      data: { status: 'COMPLETED' },
    })

    await prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    })

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to start sprint:', error)
    return { success: false, error: 'Database update failed' }
  }
}

export async function getSprintReportData(sprintId: string) {
  try {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        issues: {
          include: {
            assignee: true,
            column: true,
          },
        },
      },
    })

    if (!sprint) return { success: false, error: 'Sprint not found' }

    const doneCol = await prisma.column.findFirst({
      where: { projectId: sprint.projectId, name: { equals: 'Done', mode: 'insensitive' } },
    })

    const totalIssues = sprint.issues.length
    const completedIssues = doneCol
      ? sprint.issues.filter((i) => i.columnId === doneCol.id).length
      : 0

    const totalPoints = sprint.issues.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0)
    const completedPoints = doneCol
      ? sprint.issues
          .filter((i) => i.columnId === doneCol.id)
          .reduce((acc, curr) => acc + (curr.storyPoints || 0), 0)
      : 0
    const remainingPoints = totalPoints - completedPoints

    const memberWorkloadMap: Record<
      string,
      { name: string; avatarUrl: string | null; totalPoints: number; completedPoints: number; count: number }
    > = {}

    sprint.issues.forEach((issue) => {
      const key = issue.assigneeId || 'unassigned'
      const name = issue.assignee?.name || 'Unassigned'
      const avatarUrl = issue.assignee?.avatarUrl || null
      const points = issue.storyPoints || 0
      const isDone = doneCol && issue.columnId === doneCol.id

      if (!memberWorkloadMap[key]) {
        memberWorkloadMap[key] = { name, avatarUrl, totalPoints: 0, completedPoints: 0, count: 0 }
      }

      memberWorkloadMap[key].count += 1
      memberWorkloadMap[key].totalPoints += points
      if (isDone) {
        memberWorkloadMap[key].completedPoints += points
      }
    })

    return {
      success: true,
      data: {
        sprint,
        totalIssues,
        completedIssues,
        totalPoints,
        completedPoints,
        remainingPoints,
        workload: Object.values(memberWorkloadMap),
      },
    }
  } catch (error) {
    console.error('Failed to get sprint report data:', error)
    return { success: false, error: 'Failed to generate report' }
  }
}