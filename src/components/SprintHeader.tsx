'use client'

import { useState } from 'react'
import { Calendar, CheckCircle2, Play, Check, Plus } from 'lucide-react'
import { startSprint, completeSprint, createSprint } from '@/app/actions'

interface Sprint {
  id: string
  name: string
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED'
  startDate?: string | Date | null
  endDate?: string | Date | null
}

interface SprintHeaderProps {
  projectId: string
  activeSprint?: Sprint | null
  totalIssues: number
  completedIssues: number
}

export default function SprintHeader({
  projectId,
  activeSprint,
  totalIssues,
  completedIssues,
}: SprintHeaderProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [showNewSprintModal, setShowNewSprintModal] = useState(false)
  const [sprintName, setSprintName] = useState('')

  const handleCompleteSprint = async () => {
    if (!activeSprint || isProcessing) return
    if (!confirm('Are you sure you want to complete this sprint?')) return

    setIsProcessing(true)
    await completeSprint(activeSprint.id)
    setIsProcessing(false)
  }

  const handleStartSprint = async () => {
    if (!activeSprint || isProcessing) return
    setIsProcessing(true)
    await startSprint(activeSprint.id)
    setIsProcessing(false)
  }

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sprintName.trim() || isProcessing) return

    setIsProcessing(true)
    await createSprint(projectId, sprintName.trim())
    setSprintName('')
    setShowNewSprintModal(false)
    setIsProcessing(false)
  }

  const progressPercent = totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800">
              {activeSprint?.name ?? 'No Active Sprint'}
            </h2>
            {activeSprint && (
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  activeSprint.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {activeSprint.status}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            {activeSprint?.endDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Ends {new Date(activeSprint.endDate).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {completedIssues} of {totalIssues} issues completed ({Math.round(progressPercent)}%)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeSprint ? (
            activeSprint.status === 'ACTIVE' ? (
              <button
                onClick={handleCompleteSprint}
                disabled={isProcessing}
                className="flex items-center gap-1.5 rounded-md bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Complete Sprint
              </button>
            ) : (
              <button
                onClick={handleStartSprint}
                disabled={isProcessing}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Sprint
              </button>
            )
          ) : (
            <button
              onClick={() => setShowNewSprintModal(true)}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Sprint
            </button>
          )}
        </div>
      </div>

      {activeSprint && (
        <div className="mt-3.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {showNewSprintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Create New Sprint</h3>
            <form onSubmit={handleCreateSprint} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Sprint Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sprint 2"
                  value={sprintName}
                  onChange={(e) => setSprintName(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs focus:outline-blue-600"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSprintModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!sprintName.trim() || isProcessing}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {isProcessing ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}