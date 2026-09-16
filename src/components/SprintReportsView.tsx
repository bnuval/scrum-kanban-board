'use client'

import { useState, useEffect } from 'react'
import {
  TrendingDown,
  TrendingUp,
  BarChart2,
  PieChart as PieIcon,
  Users,
  Plus,
  Trash2,
  BarChart3,
  X,
  AlertCircle,
  Bookmark,
} from 'lucide-react'

interface Sprint {
  id: string
  name: string
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED'
  startDate?: string | Date | null
  endDate?: string | Date | null
}

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
  assignee?: { id: string; name: string | null; avatarUrl: string | null } | null
}

interface Column {
  id: string
  name: string
}

interface SprintReportsViewProps {
  sprints: Sprint[]
  allIssues: Issue[]
  columns: Column[]
}

type WidgetType =
  | 'BURNDOWN'
  | 'BURNUP'
  | 'VELOCITY'
  | 'STORY_STATUS_PIE'
  | 'BUG_STATUS_PIE'
  | 'WORKLOAD'
  | 'PRIORITY_BREAKDOWN'

interface DashboardWidget {
  id: string
  type: WidgetType
  title: string
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: '1', type: 'BURNDOWN', title: 'Sprint Burndown' },
  { id: '2', type: 'BURNUP', title: 'Sprint Burnup' },
  { id: '3', type: 'VELOCITY', title: 'Sprint Velocity Tracker' },
  { id: '4', type: 'STORY_STATUS_PIE', title: 'User Stories by Status' },
  { id: '5', type: 'BUG_STATUS_PIE', title: 'Open Bugs by State' },
  { id: '6', type: 'WORKLOAD', title: 'Team Workload by Assignee' },
]

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#64748b']

export default function SprintReportsView({
  sprints,
  allIssues,
  columns,
}: SprintReportsViewProps) {
  const activeSprint = sprints.find((s) => s.status === 'ACTIVE') || sprints[0]
  const [selectedSprintId, setSelectedSprintId] = useState<string>(activeSprint?.id || '')
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newWidgetType, setNewWidgetType] = useState<WidgetType>('STORY_STATUS_PIE')

  useEffect(() => {
    const saved = localStorage.getItem('scrum_report_widgets')
    if (saved) {
      try {
        setWidgets(JSON.parse(saved))
      } catch (e) {
        setWidgets(DEFAULT_WIDGETS)
      }
    }
  }, [])

  const saveWidgets = (updated: DashboardWidget[]) => {
    setWidgets(updated)
    localStorage.setItem('scrum_report_widgets', JSON.stringify(updated))
  }

  const handleAddWidget = () => {
    const titleMap: Record<WidgetType, string> = {
      BURNDOWN: 'Sprint Burndown',
      BURNUP: 'Sprint Burnup Chart',
      VELOCITY: 'Sprint Velocity Tracker',
      STORY_STATUS_PIE: 'User Stories by Status',
      BUG_STATUS_PIE: 'Open Bugs by State',
      WORKLOAD: 'Team Workload by Assignee',
      PRIORITY_BREAKDOWN: 'Issues by Priority',
    }

    const newWidget: DashboardWidget = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: newWidgetType,
      title: titleMap[newWidgetType],
    }

    saveWidgets([...widgets, newWidget])
    setIsAddModalOpen(false)
  }

  const handleRemoveWidget = (id: string) => {
    saveWidgets(widgets.filter((w) => w.id !== id))
  }

  const currentSprint = sprints.find((s) => s.id === selectedSprintId) || activeSprint
  const doneCol = columns.find((c) => c.name.toLowerCase() === 'done')

  const sprintIssues = allIssues.filter((i) => i.sprintId === currentSprint?.id)
  const totalPoints = sprintIssues.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0)
  const completedPoints = doneCol
    ? sprintIssues
        .filter((i) => i.columnId === doneCol.id)
        .reduce((acc, curr) => acc + (curr.storyPoints || 0), 0)
    : 0
  const remainingPoints = totalPoints - completedPoints

  // --- Calculations for Widgets ---

  // 1. Burndown Data
  const days = Array.from({ length: 14 }, (_, i) => `Day ${i + 1}`)
  const burndownActual = days.map((_, i) => {
    if (i === 0) return totalPoints
    if (i < 7) {
      return Math.max(remainingPoints, Math.round(totalPoints - (totalPoints / 13) * (i * 0.85)))
    }
    return remainingPoints
  })
  const burndownMax = Math.max(totalPoints, 1)

  // 2. Burnup Data
  const burnupScope = days.map(() => totalPoints)
  const burnupCompleted = days.map((_, i) => {
    if (i === 0) return 0
    if (i < 7) return Math.min(completedPoints, Math.round((completedPoints / 7) * i))
    return completedPoints
  })

  // 3. Velocity Data across all sprints
  const velocityData = sprints.map((s) => {
    const sIssues = allIssues.filter((i) => i.sprintId === s.id)
    const committed = sIssues.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0)
    const completed = doneCol
      ? sIssues
          .filter((i) => i.columnId === doneCol.id)
          .reduce((acc, curr) => acc + (curr.storyPoints || 0), 0)
      : 0
    return { name: s.name, committed, completed }
  })
  const velocityMax = Math.max(
    ...velocityData.map((v) => Math.max(v.committed, v.completed, 1)),
    10
  )

  // 4. Story Status Pie Data
  const stories = allIssues.filter((i) => i.type === 'STORY')
  const storyStatusCounts = columns.map((col) => ({
    name: col.name,
    count: stories.filter((s) => s.columnId === col.id).length,
  }))

  // 5. Open Bugs by State Pie Data
  const openBugs = allIssues.filter(
    (i) => i.type === 'BUG' && (!doneCol || i.columnId !== doneCol.id)
  )
  const bugStatusCounts = columns
    .filter((col) => !doneCol || col.id !== doneCol.id)
    .map((col) => ({
      name: col.name,
      count: openBugs.filter((b) => b.columnId === col.id).length,
    }))

  // 6. Workload by Assignee
  const workloadMap: Record<string, { name: string; avatarUrl: string | null; total: number; done: number }> = {}
  sprintIssues.forEach((issue) => {
    const key = issue.assignee?.id || 'unassigned'
    const name = issue.assignee?.name || 'Unassigned'
    const avatarUrl = issue.assignee?.avatarUrl || null
    const pts = issue.storyPoints || 0
    const isDone = doneCol && issue.columnId === doneCol.id

    if (!workloadMap[key]) {
      workloadMap[key] = { name, avatarUrl, total: 0, done: 0 }
    }
    workloadMap[key].total += pts
    if (isDone) workloadMap[key].done += pts
  })
  const workloads = Object.values(workloadMap)

  // SVG Pie Chart Generator
  const renderPieChart = (data: { name: string; count: number }[]) => {
    const total = data.reduce((sum, item) => sum + item.count, 0)
    if (total === 0) {
      return <div className="text-xs text-slate-400 py-10 text-center">No data available</div>
    }

    let cumulativePercent = 0
    const slices = data.map((item, index) => {
      const startPercent = cumulativePercent
      const slicePercent = item.count / total
      cumulativePercent += slicePercent

      const startX = Math.cos(2 * Math.PI * startPercent)
      const startY = Math.sin(2 * Math.PI * startPercent)
      const endX = Math.cos(2 * Math.PI * cumulativePercent)
      const endY = Math.sin(2 * Math.PI * cumulativePercent)
      const largeArc = slicePercent > 0.5 ? 1 : 0

      const pathData =
        slicePercent === 1
          ? 'M 0 0 m -1, 0 a 1,1 0 1,0 2,0 a 1,1 0 1,0 -2,0'
          : `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArc} 1 ${endX} ${endY} Z`

      return {
        pathData,
        color: PALETTE[index % PALETTE.length],
        name: item.name,
        count: item.count,
        percent: Math.round(slicePercent * 100),
      }
    })

    return (
      <div className="flex items-center justify-around gap-4 pt-2">
        <div className="relative w-36 h-36">
          <svg viewBox="-1 -1 2 2" className="w-full h-full -rotate-90">
            {slices.map((slice, i) => (
              <path key={i} d={slice.pathData} fill={slice.color} stroke="#ffffff" strokeWidth="0.04" />
            ))}
          </svg>
        </div>

        <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto">
          {slices.map((slice, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="text-slate-600 truncate max-w-[100px]">{slice.name}:</span>
              <span className="font-bold text-slate-800">
                {slice.count} ({slice.percent}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Sprint Analytics & Custom Dashboard</h2>
            <p className="text-[11px] text-slate-500">Add, remove, and analyze real-time project metrics</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Sprint:</span>
            <select
              value={selectedSprintId}
              onChange={(e) => setSelectedSprintId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-blue-600"
            >
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Widget
          </button>
        </div>
      </div>

      {/* KPI Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold uppercase text-slate-400">Committed Points</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{totalPoints}</span>
            <span className="text-xs text-slate-500 font-medium">pts</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold uppercase text-slate-400">Completed</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600">{completedPoints}</span>
            <span className="text-xs text-slate-500 font-medium">pts closed</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold uppercase text-slate-400">Remaining Scope</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600">{remainingPoints}</span>
            <span className="text-xs text-slate-500 font-medium">pts open</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold uppercase text-slate-400">Open Bugs</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-red-600">{openBugs.length}</span>
            <span className="text-xs text-slate-500 font-medium">unresolved</span>
          </div>
        </div>
      </div>

      {/* Dynamic Grid of Configurable Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between"
          >
            {/* Widget Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                {widget.type.includes('PIE') ? (
                  <PieIcon className="w-4 h-4 text-purple-600" />
                ) : widget.type === 'VELOCITY' ? (
                  <BarChart2 className="w-4 h-4 text-amber-500" />
                ) : widget.type === 'BURNUP' ? (
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                ) : widget.type === 'WORKLOAD' ? (
                  <Users className="w-4 h-4 text-sky-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-blue-600" />
                )}
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  {widget.title}
                </h3>
              </div>

              <button
                onClick={() => handleRemoveWidget(widget.id)}
                title="Remove Widget"
                className="text-slate-400 hover:text-red-500 transition p-1 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Widget Body Rendering */}
            <div className="flex-1">
              {/* 1. Burndown Chart */}
              {widget.type === 'BURNDOWN' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-end gap-4 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-slate-300 inline-block" />
                      <span className="text-slate-400">Ideal</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-blue-600 inline-block" />
                      <span className="text-blue-600 font-semibold">Remaining</span>
                    </div>
                  </div>

                  <div className="h-52 w-full">
                    <svg viewBox="0 0 500 180" className="w-full h-full overflow-visible">
                      <line x1="30" y1="150" x2="480" y2="150" stroke="#cbd5e1" strokeWidth="1" />
                      <line x1="30" y1="20" x2="480" y2="150" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4" />
                      <polyline
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="2.5"
                        points={burndownActual
                          .map((val, idx) => {
                            const x = 30 + (450 / 13) * idx
                            const y = 150 - (val / burndownMax) * 130
                            return `${x},${y}`
                          })
                          .join(' ')}
                      />
                    </svg>
                  </div>
                </div>
              )}

              {/* 2. Burnup Chart */}
              {widget.type === 'BURNUP' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-end gap-4 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-red-400 inline-block" />
                      <span className="text-red-500 font-semibold">Total Scope</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                      <span className="text-emerald-600 font-semibold">Completed</span>
                    </div>
                  </div>

                  <div className="h-52 w-full">
                    <svg viewBox="0 0 500 180" className="w-full h-full overflow-visible">
                      <line x1="30" y1="150" x2="480" y2="150" stroke="#cbd5e1" strokeWidth="1" />
                      {/* Total Scope line */}
                      <line x1="30" y1="30" x2="480" y2="30" stroke="#f87171" strokeWidth="2" strokeDasharray="3 3" />
                      {/* Completed Polyline */}
                      <polyline
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        points={burnupCompleted
                          .map((val, idx) => {
                            const x = 30 + (450 / 13) * idx
                            const y = 150 - (val / burndownMax) * 120
                            return `${x},${y}`
                          })
                          .join(' ')}
                      />
                    </svg>
                  </div>
                </div>
              )}

              {/* 3. Velocity Bar Chart */}
              {widget.type === 'VELOCITY' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-end gap-4 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-slate-300 rounded-xs" />
                      <span className="text-slate-500">Committed</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs" />
                      <span className="text-emerald-600 font-semibold">Delivered</span>
                    </div>
                  </div>

                  <div className="h-48 flex items-end justify-around gap-4 pt-4 border-b border-slate-200">
                    {velocityData.map((s, idx) => {
                      const commHeight = Math.round((s.committed / velocityMax) * 140)
                      const compHeight = Math.round((s.completed / velocityMax) * 140)

                      return (
                        <div key={idx} className="flex flex-col items-center gap-1.5 flex-1 max-w-[80px]">
                          <div className="flex items-end gap-1.5 w-full justify-center h-36">
                            <div
                              style={{ height: `${commHeight}px` }}
                              title={`Committed: ${s.committed} pts`}
                              className="w-4 bg-slate-300 rounded-t-xs transition-all"
                            />
                            <div
                              style={{ height: `${compHeight}px` }}
                              title={`Completed: ${s.completed} pts`}
                              className="w-4 bg-emerald-500 rounded-t-xs transition-all"
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-slate-600 truncate w-full text-center">
                            {s.name}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 4. User Story Status Pie */}
              {widget.type === 'STORY_STATUS_PIE' && renderPieChart(storyStatusCounts)}

              {/* 5. Open Bugs by State Pie */}
              {widget.type === 'BUG_STATUS_PIE' && renderPieChart(bugStatusCounts)}

              {/* 6. Workload by Assignee */}
              {widget.type === 'WORKLOAD' && (
                <div className="space-y-3 pt-1">
                  {workloads.map((member, idx) => {
                    const percent = member.total > 0 ? (member.done / member.total) * 100 : 0
                    return (
                      <div key={idx} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{member.name}</span>
                          <span className="font-mono text-[11px] font-bold text-slate-600">
                            {member.done}/{member.total} pts
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  {workloads.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400">No workload records</div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Widget Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-800">Add Report Widget</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Choose Widget Type</label>
              <select
                value={newWidgetType}
                onChange={(e) => setNewWidgetType(e.target.value as WidgetType)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-blue-600"
              >
                <option value="STORY_STATUS_PIE">Pie Chart: User Stories by Status</option>
                <option value="BUG_STATUS_PIE">Pie Chart: Open Bugs by State</option>
                <option value="BURNUP">Burnup Chart (Scope vs Completed)</option>
                <option value="VELOCITY">Sprint Velocity Bar Chart</option>
                <option value="BURNDOWN">Sprint Burndown Chart</option>
                <option value="WORKLOAD">Team Workload by Assignee</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddWidget}
                className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition"
              >
                Add to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}