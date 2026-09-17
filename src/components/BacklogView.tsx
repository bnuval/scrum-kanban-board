'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Layers,
  Sparkles,
  Bookmark,
  AlertCircle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Minus,
  Plus,
  Play,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  Lock,
} from 'lucide-react'
import {
  createSprint,
  startSprint,
  completeSprint,
  assignIssueSprint,
} from '@/app/actions'
import IssueDetailDrawer from '@/components/IssueDetailDrawer'

interface Issue {
  id: string
  key: string
  title: string
  description?: string | null
  type: string
  priority: string
  order: number
  columnId: string
  sprintId?: string | null
  storyPoints?: number | null
  parentId?: string | null
  assignee?: { id: string; name: string | null; avatarUrl: string | null } | null
}

interface Sprint {
  id: string
  name: string
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED'
  startDate?: string | Date | null
  endDate?: string | Date | null
}

interface Column {
  id: string
  name: string
}

interface BacklogViewProps {
  projectId: string
  sprints: Sprint[]
  allIssues: Issue[]
  columns: Column[]
  isReadOnly?: boolean
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
      return <Layers className="w-3.5 h-3.5 text-purple-600 fill-purple-600" />
    case 'FEATURE':
      return <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
    case 'STORY':
      return <Bookmark className="w-3.5 h-3.5 text-green-600 fill-green-600" />
    case 'BUG':
      return <AlertCircle className="w-3.5 h-3.5 text-red-600 fill-red-600" />
    case 'TASK':
    default:
      return <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
  }
}

export default function BacklogView({
  projectId,
  sprints,
  allIssues: initialIssues,
  columns,
  isReadOnly = false,
}: BacklogViewProps) {
  const searchParams = useSearchParams()

  const [issues, setIssues] = useState<Issue[]>(initialIssues)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedSprints, setCollapsedSprints] = useState<Record<string, boolean>>({})

  // Initialize selected issue key from URL if provided
  const initialIssueKey = searchParams.get('selectedIssue')
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(initialIssueKey)

  useEffect(() => {
    setIssues(initialIssues)
  }, [initialIssues])

  // Sync if URL search params change externally
  useEffect(() => {
    const key = searchParams.get('selectedIssue')
    if (key) {
      setSelectedIssueKey(key)
    }
  }, [searchParams])

  const handleOpenDrawer = (key: string) => {
    setSelectedIssueKey(key)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('selectedIssue', key)
      window.history.replaceState({}, '', url.toString())
    }
  }

  const handleCloseDrawer = () => {
    setSelectedIssueKey(null)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('selectedIssue')
      window.history.replaceState({}, '', url.toString())
    }
  }

  const selectedIssue = useMemo(() => {
    if (!selectedIssueKey) return null
    return issues.find((i) => i.key.toUpperCase() === selectedIssueKey.toUpperCase()) || null
  }, [selectedIssueKey, issues])

  const filteredIssues = useMemo(() => {
    if (!searchQuery.trim()) return issues
    const query = searchQuery.toLowerCase()
    return issues.filter(
      (i) =>
        i.title.toLowerCase().includes(query) ||
        i.key.toLowerCase().includes(query)
    )
  }, [issues, searchQuery])

  const sprintMap = useMemo(() => {
    const map: Record<string, Issue[]> = {}
    sprints.forEach((s) => {
      map[s.id] = []
    })
    const backlogList: Issue[] = []

    filteredIssues.forEach((issue) => {
      if (issue.sprintId && map[issue.sprintId]) {
        map[issue.sprintId].push(issue)
      } else {
        backlogList.push(issue)
      }
    })

    return { map, backlogList }
  }, [filteredIssues, sprints])

  const toggleSprintCollapse = (id: string) => {
    setCollapsedSprints((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleMoveIssueSprint = async (issueId: string, newSprintId: string | null) => {
    if (isReadOnly) return
    setIssues((prev) =>
      prev.map((i) => (i.id === issueId ? { ...i, sprintId: newSprintId } : i))
    )
    const res = await assignIssueSprint(issueId, newSprintId)
    if (!res.success) {
      alert(res.error || 'Failed to update iteration path')
      setIssues(initialIssues)
    }
  }

  const renderIssueRow = (issue: Issue) => {
    const column = columns.find((c) => c.id === issue.columnId)
    const assignedSprint = sprints.find((s) => s.id === issue.sprintId)

    return (
      <div
        key={issue.id}
        onClick={() => handleOpenDrawer(issue.key)}
        className="group flex items-center justify-between gap-4 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-xs transition cursor-pointer select-none"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="shrink-0">
            <IssueTypeIcon type={issue.type} />
          </span>
          <span className="font-mono text-xs font-bold text-slate-700 hover:text-blue-600 transition">
            {issue.key}
          </span>
          <span className="text-xs font-medium text-slate-800 truncate">
            {issue.title}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isReadOnly ? (
            <span className="text-[11px] bg-slate-100 border border-slate-200 text-slate-600 font-medium px-2 py-1 rounded">
              {assignedSprint ? assignedSprint.name : 'Backlog'}
            </span>
          ) : (
            <select
              value={issue.sprintId || ''}
              onChange={(e) => handleMoveIssueSprint(issue.id, e.target.value || null)}
              className="text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-600 font-medium focus:outline-blue-500 cursor-pointer"
            >
              <option value="">Backlog</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          )}

          {column && (
            <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">
              {column.name}
            </span>
          )}

          {issue.storyPoints !== null && issue.storyPoints !== undefined ? (
            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
              {issue.storyPoints} pts
            </span>
          ) : (
            <span className="text-xs text-slate-400 px-2">-</span>
          )}

          <PriorityIcon priority={issue.priority} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
          <Lock className="w-4 h-4 shrink-0" />
          Read-Only Mode: Sprint planning and iteration movement are restricted to the primary team members of this board.
        </div>
      )}

      {/* Search Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search backlog tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-blue-500"
          />
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={() => createSprint(projectId, `Sprint ${sprints.length + 1}`)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Sprint
          </button>
        )}
      </div>

      {/* Sprints Sections */}
      <div className="space-y-4">
        {sprints.map((sprint) => {
          const sprintIssues = sprintMap.map[sprint.id] || []
          const totalPoints = sprintIssues.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0)
          const isCollapsed = !!collapsedSprints[sprint.id]

          return (
            <div
              key={sprint.id}
              className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div
                  onClick={() => toggleSprintCollapse(sprint.id)}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <button type="button" className="text-slate-500">
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <h2 className="text-sm font-bold text-slate-900">{sprint.name}</h2>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      sprint.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-700'
                        : sprint.status === 'COMPLETED'
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {sprint.status}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    ({sprintIssues.length} issues · {totalPoints} pts)
                  </span>
                </div>

                {!isReadOnly && (
                  <div className="flex items-center gap-2">
                    {sprint.status === 'PLANNED' && (
                      <button
                        type="button"
                        onClick={() => startSprint(sprint.id)}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 py-1 rounded transition cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        Start Sprint
                      </button>
                    )}
                    {sprint.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => completeSprint(sprint.id, null)}
                        className="flex items-center gap-1 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold px-2.5 py-1 rounded transition cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        Complete Sprint
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <div className="space-y-2">
                  {sprintIssues.map((issue) => renderIssueRow(issue))}
                  {sprintIssues.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white">
                      No issues planned for this sprint yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Backlog pool */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Backlog ({sprintMap.backlogList.length} issues)
            </h2>
          </div>
          <div className="space-y-2">
            {sprintMap.backlogList.map((issue) => renderIssueRow(issue))}
            {sprintMap.backlogList.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white">
                Backlog is empty.
              </div>
            )}
          </div>
        </div>
      </div>

      <IssueDetailDrawer
        issue={selectedIssue as any}
        allProjectIssues={issues as any}
        columns={columns}
        isReadOnly={isReadOnly}
        onClose={handleCloseDrawer}
        onNavigateIssue={(key) => handleOpenDrawer(key)}
      />
    </div>
  )
}