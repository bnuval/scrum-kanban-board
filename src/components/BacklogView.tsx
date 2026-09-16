'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Calendar,
  Play,
  Check,
  Plus,
  ArrowUp,
  ArrowDown,
  Minus,
  CheckCircle2,
  Bookmark,
  AlertCircle,
  Layers,
  Sparkles,
} from 'lucide-react'
import { assignIssueSprint, startSprint, completeSprint, createSprint } from '@/app/actions'

interface Issue {
  id: string
  key: string
  title: string
  type: string
  priority: string
  storyPoints?: number | null
  columnId: string
  sprintId?: string | null
  column?: { name: string } | null
  assignee?: { name: string | null; avatarUrl: string | null } | null
}

interface Sprint {
  id: string
  name: string
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED'
  startDate?: string | Date | null
  endDate?: string | Date | null
}

interface BacklogViewProps {
  projectId: string
  sprints: Sprint[]
  allIssues: Issue[]
  columns: { id: string; name: string }[]
}

function PriorityIcon({ priority }: { priority: string }) {
  switch (priority) {
    case 'HIGHEST':
    case 'HIGH':
      return <ArrowUp className="w-3.5 h-3.5 text-red-500" />
    case 'MEDIUM':
      return <Minus className="w-3.5 h-3.5 text-orange-400" />
    case 'LOW':
    case 'LOWEST':
      return <ArrowDown className="w-3.5 h-3.5 text-blue-500" />
    default:
      return null
  }
}

function IssueTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'EPIC':
      return <Layers className="w-3.5 h-3.5 text-purple-600 fill-purple-600 shrink-0" />
    case 'FEATURE':
      return <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
    case 'STORY':
      return <Bookmark className="w-3.5 h-3.5 text-green-600 fill-green-600 shrink-0" />
    case 'BUG':
      return <AlertCircle className="w-3.5 h-3.5 text-red-600 fill-red-600 shrink-0" />
    case 'TASK':
    default:
      return <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
  }
}

export default function BacklogView({
  projectId,
  sprints,
  allIssues,
  columns,
}: BacklogViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isProcessing, setIsProcessing] = useState(false)
  const [newSprintName, setNewSprintName] = useState('')
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completingSprint, setCompletingSprint] = useState<Sprint | null>(null)
  const [rollOverTarget, setRollOverTarget] = useState<string>('')

  const activeSprint = sprints.find((s) => s.status === 'ACTIVE')
  const plannedSprints = sprints.filter((s) => s.status === 'PLANNED')
  const backlogIssues = allIssues.filter((i) => !i.sprintId)

  const handleOpenIssue = (key: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('selectedIssue', key)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const handleCreateSprint = async () => {
    if (isProcessing) return
    setIsProcessing(true)
    await createSprint(projectId, newSprintName.trim())
    setNewSprintName('')
    setIsProcessing(false)
  }

  const handleStartSprint = async (sprintId: string) => {
    if (isProcessing) return
    setIsProcessing(true)
    await startSprint(sprintId)
    setIsProcessing(false)
  }

  const handleOpenCompleteModal = (sprint: Sprint) => {
    setCompletingSprint(sprint)
    const nextPlanned = plannedSprints.find((s) => s.id !== sprint.id)
    setRollOverTarget(nextPlanned ? nextPlanned.id : '')
    setShowCompleteModal(true)
  }

  const handleConfirmCompleteSprint = async () => {
    if (!completingSprint || isProcessing) return
    setIsProcessing(true)
    await completeSprint(completingSprint.id, rollOverTarget || null)
    setShowCompleteModal(false)
    setCompletingSprint(null)
    setIsProcessing(false)
  }

  const handleMoveIssue = async (issueId: string, sprintId: string | null) => {
    await assignIssueSprint(issueId, sprintId)
  }

  const renderIssueRow = (issue: Issue, currentSprintId: string | null) => {
    const issueCol = columns.find((c) => c.id === issue.columnId)

    return (
      <div
        key={issue.id}
        className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-md hover:border-slate-300 hover:shadow-xs transition text-xs gap-3"
      >
        <div className="flex items-center gap-2.5 overflow-hidden flex-1">
          <button
            type="button"
            onClick={() => handleOpenIssue(issue.key)}
            className="flex items-center gap-1 font-mono font-bold text-blue-700 hover:underline shrink-0"
          >
            <IssueTypeIcon type={issue.type} />
            {issue.key}
          </button>
          <span
            onClick={() => handleOpenIssue(issue.key)}
            className="text-slate-800 font-medium truncate cursor-pointer hover:text-blue-600 transition"
          >
            {issue.title}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold text-[11px]">
            {issueCol?.name ?? 'To Do'}
          </span>

          <PriorityIcon priority={issue.priority} />

          {issue.storyPoints ? (
            <span className="font-mono text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
              {issue.storyPoints} pts
            </span>
          ) : (
            <span className="text-slate-300 text-[10px]">-</span>
          )}

          <select
            value={currentSprintId || ''}
            onChange={(e) => handleMoveIssue(issue.id, e.target.value || null)}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] font-medium text-slate-700 focus:outline-blue-600"
          >
            <option value="">Backlog</option>
            {sprints
              .filter((s) => s.status !== 'COMPLETED')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.status === 'ACTIVE' ? '(Active)' : ''}
                </option>
              ))}
          </select>
        </div>
      </div>
    )
  }

  const renderSprintBox = (sprint: Sprint, issues: Issue[]) => {
    const totalPoints = issues.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0)

    return (
      <div
        key={sprint.id}
        className={`rounded-xl border bg-slate-50/60 p-4 space-y-3 ${
          sprint.status === 'ACTIVE'
            ? 'border-blue-300 shadow-xs ring-1 ring-blue-100'
            : 'border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">{sprint.name}</h3>
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                sprint.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {sprint.status}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {issues.length} {issues.length === 1 ? 'issue' : 'issues'} · {totalPoints} pts
            </span>
          </div>

          <div className="flex items-center gap-2">
            {sprint.status === 'ACTIVE' ? (
              <button
                onClick={() => handleOpenCompleteModal(sprint)}
                className="flex items-center gap-1 bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1 rounded text-xs font-semibold transition"
              >
                <Check className="w-3.5 h-3.5" />
                Complete Sprint
              </button>
            ) : (
              <button
                onClick={() => handleStartSprint(sprint.id)}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold transition"
              >
                <Play className="w-3 h-3 fill-current" />
                Start Sprint
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          {issues.map((issue) => renderIssueRow(issue, sprint.id))}
          {issues.length === 0 && (
            <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white">
              Plan sprint by moving issues here from the backlog below
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span>Sprint Planning</span>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500 font-normal">Organize backlog tickets into sprints</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="New sprint name (e.g. Sprint 3)..."
            value={newSprintName}
            onChange={(e) => setNewSprintName(e.target.value)}
            className="border border-slate-200 rounded-md px-3 py-1.5 text-xs bg-slate-50 focus:outline-blue-600"
          />
          <button
            onClick={handleCreateSprint}
            disabled={!newSprintName.trim() || isProcessing}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Sprint
          </button>
        </div>
      </div>

      {activeSprint && (
        renderSprintBox(
          activeSprint,
          allIssues.filter((i) => i.sprintId === activeSprint.id)
        )
      )}

      {plannedSprints.map((sprint) =>
        renderSprintBox(
          sprint,
          allIssues.filter((i) => i.sprintId === sprint.id)
        )
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">Product Backlog</h3>
            <span className="text-xs text-slate-500 font-medium">
              {backlogIssues.length} issues ·{' '}
              {backlogIssues.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0)} pts
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          {backlogIssues.map((issue) => renderIssueRow(issue, null))}
          {backlogIssues.length === 0 && (
            <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
              No unassigned issues in the backlog
            </div>
          )}
        </div>
      </div>

      {showCompleteModal && completingSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Complete {completingSprint.name}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Select where incomplete issues from this sprint should be moved:
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Move open issues to:
              </label>
              <select
                value={rollOverTarget}
                onChange={(e) => setRollOverTarget(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-blue-600"
              >
                <option value="">Product Backlog</option>
                {plannedSprints
                  .filter((s) => s.id !== completingSprint.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Planned)
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCompleteSprint}
                disabled={isProcessing}
                className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition disabled:opacity-50"
              >
                {isProcessing ? 'Completing...' : 'Confirm & Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}