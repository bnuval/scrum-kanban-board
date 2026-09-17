'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { TShirtSize, PlanRiskStatus, IssueType } from '@prisma/client'

const SPRINT_DURATIONS: Record<TShirtSize, number> = {
  XS: 1, // 1 Sprint
  S: 2,  // 2 Sprints
  M: 3,  // 3 Sprints
  L: 4,  // 4 Sprints
  XL: 5, // >4 Sprints (5 default)
}

/**
 * Update Feature T-Shirt Size and recalculate Planned Gantt Span
 */
export async function updateFeatureTShirtSize(
  featureId: string,
  size: TShirtSize,
  startSprint: number = 1
) {
  try {
    const duration = SPRINT_DURATIONS[size]
    const endSprint = startSprint + duration - 1

    const updated = await prisma.issue.update({
      where: { id: featureId },
      data: {
        tShirtSize: size,
        startSprintIdx: startSprint,
        endSprintIdx: endSprint,
      },
    })

    revalidatePath('/?view=pi-planning')
    return { success: true, feature: updated }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update T-Shirt Size' }
  }
}

/**
 * Assign Feature to a Delivering Team / Board
 */
export async function alignFeatureToTeam(featureId: string, teamProjectId: string) {
  try {
    const updated = await prisma.issue.update({
      where: { id: featureId },
      data: { targetTeamId: teamProjectId },
    })
    revalidatePath('/?view=pi-planning')
    return { success: true, feature: updated }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to align team' }
  }
}

/**
 * Save PI Baseline to Freeze Planned Delivery Dates
 */
export async function savePIBaselinePlan(piName: string, orgId: string) {
  try {
    const features = await prisma.issue.findMany({
      where: {
        type: IssueType.FEATURE,
        project: { organizationId: orgId },
        tShirtSize: { not: null },
      },
    })

    for (const f of features) {
      if (f.tShirtSize) {
        await prisma.planBaseline.create({
          data: {
            featureId: f.id,
            piName,
            startSprintIdx: f.startSprintIdx,
            endSprintIdx: f.endSprintIdx,
            tShirtSize: f.tShirtSize,
          },
        })
      }
    }

    revalidatePath('/?view=pi-planning')
    return { success: true, count: features.length }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to freeze baseline' }
  }
}

/**
 * Flag / Resolve / Ignore Execution Risk on Feature
 */
export async function setFeatureRiskStatus(
  featureId: string,
  riskStatus: PlanRiskStatus,
  notes?: string
) {
  try {
    await prisma.issue.update({
      where: { id: featureId },
      data: {
        riskStatus,
        riskNotes: notes,
      },
    })
    revalidatePath('/?view=pi-planning')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update risk' }
  }
}