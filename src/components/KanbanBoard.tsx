'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import {
  CheckCircle2,
  Bookmark,
  AlertCircle,
  Layers,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
  Search,
  User,
  X,
  ChevronDown,
  ChevronRight,
  CheckCheck,
  FolderTree,
  Radio,
} from 'lucide-react'
import { updateIssuePosition, updateIssueParent } from '@/app/actions'
import { supabase } from '@/lib/supabaseClient'
import IssueDetailDrawer from '@/components/IssueDetailDrawer'

interface Comment {
  id: string
  body: string
  createdAt: string | Date
  user: { name: string | null; avatarUrl: string | null }
}

interface RelatedIssue {
  id: string
  key: string
  title: string
  type: string
  isCompleted?: boolean
  columnId?: string
  assignee?: { name: string | null; avatarUrl: string | null } | null
}

interface UserOption {
  id: string
  name: string | null
  avatarUrl: string | null
}

interface Issue {
  id: string
  key: string
  title: string
  description: string | null
  type: any
  priority: string
  order: number
  columnId: string
  storyPoints?: number | null
  parentId?: string | null
  parent?: RelatedIssue | null
  children?: Issue[]
  outgoingLinks?: { id: string; type: string; target: RelatedIssue }[]
  incomingLinks?: { id: string; type: string; source: RelatedIssue }[]
  assignee?: { id: string; name: string | null; avatarUrl: string | null } | null
  comments?: Comment[]
}

interface Column {
  id: string
  name: string
  order: number
}

interface KanbanBoardProps {
  columns: Column[]
  allIssues: Issue[]
  users?: UserOption[]
  currentUserId?: string
}

interface PresenceUser {
  userId: string
  name: string
  avatarUrl?: string | null
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

function KanbanBoardContent({
  columns,
  allIssues: initialIssues,
  users = [],
  currentUserId,
}: KanbanBoardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedKeyFromUrl = searchParams.get('selectedIssue')

  const [issues, setIssues] = useState<Issue[]>(initialIssues)
  const [activeCollaborators, setActiveCollaborators] = useState<PresenceUser[]>([])
  const [collapsedEpics, setCollapsedEpics] = useState<Record<string, boolean>>({})
  const [isMounted, setIsMounted] = useState(false)

  // Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | 'ALL'>('ALL')
  const [onlyMyIssues, setOnlyMyIssues] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setIssues(initialIssues)
  }, [initialIssues])

  // Real-Time Subscription & Presence Channel
  useEffect(() => {
    const currentUser = users.find((u) => u.id === currentUserId) || {
      id: currentUserId || 'anon',
      name: 'Team Member',
      avatarUrl: null,
    }

    const channel = supabase.channel('scrum_live_board', {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    })

    // 1. Listen for remote database updates on Issue
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'Issue' },
      (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as any
          setIssues((prev) =>
            prev.map((i) =>
              i.id === updated.id
                ? {
                    ...i,
                    columnId: updated.columnId,
                    order: updated.order,
                    title: updated.title,
                    description: updated.description,
                    priority: updated.priority,
                    storyPoints: updated.storyPoints,
                    parentId: updated.parentId,
                  }
                : i
            )
          )
        } else if (payload.eventType === 'INSERT') {
          router.refresh()
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old.id
          setIssues((prev) => prev.filter((i) => i.id !== deletedId))
        }
      }
    )

    // 2. Track multi-user online presence
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const onlineUsers: PresenceUser[] = []
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.userId && !onlineUsers.some((u) => u.userId === p.userId)) {
              onlineUsers.push(p)
            }
          })
        })
        setActiveCollaborators(onlineUsers)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: currentUser.id,
            name: currentUser.name || 'Anonymous',
            avatarUrl: currentUser.avatarUrl,
          })
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [currentUserId, users, router])

  const selectedIssue = useMemo(() => {
    if (!selectedKeyFromUrl) return null
    return issues.find((i) => i.key.toUpperCase() === selectedKeyFromUrl.toUpperCase()) || null
  }, [selectedKeyFromUrl, issues])

  const handleOpenDrawer = (key: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('selectedIssue', key)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const handleCloseDrawer = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('selectedIssue')
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const doneCol = useMemo(
    () => columns.find((c) => c.name.toLowerCase() === 'done'),
    [columns]
  )
  const inProgressCol = useMemo(
    () => columns.find((c) => c.name.toLowerCase() === 'in progress'),
    [columns]
  )

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesSearch =
        issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.key.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesType = typeFilter === 'ALL' || issue.type === typeFilter
      const matchesPriority = priorityFilter === 'ALL' || issue.priority === priorityFilter

      let matchesAssignee = true
      if (onlyMyIssues && currentUserId) {
        matchesAssignee = issue.assignee?.id === currentUserId
      } else if (selectedAssigneeId !== 'ALL') {
        matchesAssignee = issue.assignee?.id === selectedAssigneeId
      }

      return matchesSearch && matchesType && matchesPriority && matchesAssignee
    })
  }, [issues, searchQuery, typeFilter, priorityFilter, selectedAssigneeId, onlyMyIssues, currentUserId])

  const handleStoryStatusChange = async (storyId: string, newColId: string) => {
    setIssues((prev) =>
      prev.map((item) => (item.id === storyId ? { ...item, columnId: newColId } : item))
    )
    await updateIssuePosition(storyId, newColId, 1)
  }

  const handleTagStoryToFeature = async (storyId: string, featureId: string | null) => {
    setIssues((prev) =>
      prev.map((item) => (item.id === storyId ? { ...item, parentId: featureId } : item))
    )
    await updateIssueParent(storyId, featureId)
  }

  const hierarchyTree = useMemo(() => {
    const issueMap = new Map<string, Issue>()
    issues.forEach((i) => issueMap.set(i.id, i))

    const epics = issues.filter((i) => i.type === 'EPIC')
    const features = issues.filter((i) => i.type === 'FEATURE')
    const stories = issues.filter((i) => i.type === 'STORY')

    const storiesByFeature = new Map<string, Issue[]>()
    const featuresByEpic = new Map<string, Issue[]>()
    const standaloneStories: Issue[] = []

    stories.forEach((story) => {
      if (story.parentId) {
        const parent = issueMap.get(story.parentId)
        if (parent?.type === 'FEATURE') {
          const list = storiesByFeature.get(parent.id) || []
          list.push(story)
          storiesByFeature.set(parent.id, list)
        } else if (parent?.type === 'EPIC') {
          const list = featuresByEpic.get(parent.id) || []
          list.push(story)
          featuresByEpic.set(parent.id, list)
        } else {
          standaloneStories.push(story)
        }
      } else {
        standaloneStories.push(story)
      }
    })

    features.forEach((feat) => {
      if (feat.parentId) {
        const list = featuresByEpic.get(feat.parentId) || []
        list.push(feat)
        featuresByEpic.set(feat.parentId, list)
      }
    })

    const workItemsByStory = new Map<string, Issue[]>()
    filteredIssues.forEach((item) => {
      if ((item.type === 'TASK' || item.type === 'BUG') && item.parentId) {
        const list = workItemsByStory.get(item.parentId) || []
        list.push(item)
        workItemsByStory.set(item.parentId, list)
      }
    })

    const independentWorkItems = filteredIssues.filter(
      (i) => (i.type === 'TASK' || i.type === 'BUG') && !i.parentId
    )

    return {
      epics,
      features,
      featuresByEpic,
      storiesByFeature,
      standaloneStories,
      workItemsByStory,
      independentWorkItems,
    }
  }, [issues, filteredIssues])

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const [destStoryId, destColumnId] = destination.droppableId.split('::')
    const targetParentId = destStoryId === 'orphan' ? null : destStoryId

    const movedItem = issues.find((i) => i.id === draggableId)
    if (!movedItem) return

    let updatedList = issues.map((item) =>
      item.id === draggableId
        ? { ...item, columnId: destColumnId, parentId: targetParentId }
        : item
    )

    if (targetParentId && doneCol) {
      const destStory = issues.find((i) => i.id === targetParentId)
      if (destStory) {
        const siblings = updatedList.filter((i) => i.parentId === targetParentId)
        const allDone = siblings.every((w) => w.columnId === doneCol.id)

        if (allDone && destStory.columnId !== doneCol.id) {
          updatedList = updatedList.map((item) =>
            item.id === targetParentId ? { ...item, columnId: doneCol.id } : item
          )
        }
      }
    }

    setIssues(updatedList)
    await updateIssuePosition(draggableId, destColumnId, destination.index + 1, targetParentId)
  }

  const toggleEpic = (id: string) => {
    setCollapsedEpics((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  if (!isMounted) return null

  const renderStorySwimlane = (story: Issue) => {
    const workItems = hierarchyTree.workItemsByStory.get(story.id) || []
    const totalCount = workItems.length
    const doneCount = doneCol ? workItems.filter((w) => w.columnId === doneCol.id).length : 0
    const isAllDone = totalCount > 0 && doneCount === totalCount
    const progressPercent = totalCount > 0 ? (doneCount / totalCount) * 100 : 0
    const isDoneState = doneCol && story.columnId === doneCol.id

    return (
      <div
        key={story.id}
        className={`flex flex-col lg:flex-row border-b border-slate-200 bg-white transition-colors ${
          isDoneState ? 'bg-emerald-50/15' : ''
        }`}
      >
        <div className="w-full lg:w-80 shrink-0 p-4 border-r border-slate-200 bg-slate-50/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1 mb-2">
              <button
                type="button"
                onClick={() => handleOpenDrawer(story.key)}
                className="inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 hover:underline"
              >
                <IssueTypeIcon type={story.type} />
                {story.key}
              </button>

              <div className="flex items-center gap-1.5">
                {isAllDone && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                    <CheckCheck className="w-3 h-3" /> Auto-Done
                  </span>
                )}
                <PriorityIcon priority={story.priority} />
              </div>
            </div>

            <p
              onClick={() => handleOpenDrawer(story.key)}
              className="text-xs font-semibold text-slate-900 leading-snug cursor-pointer hover:text-blue-600 transition"
            >
              {story.title}
            </p>

            <div className="mt-3 flex items-center justify-between gap-2 bg-white px-2 py-1 rounded border border-slate-200 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <FolderTree className="w-3 h-3" /> Feature:
              </span>
              <select
                value={story.parentId || ''}
                onChange={(e) => handleTagStoryToFeature(story.id, e.target.value || null)}
                className="text-[11px] font-medium text-slate-700 bg-transparent focus:outline-none max-w-[150px] truncate cursor-pointer"
              >
                <option value="">No Feature</option>
                {hierarchyTree.features.map((f) => (
                  <option key={f.id} value={f.id}>
                    [{f.key}] {f.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 bg-white px-2 py-1 rounded border border-slate-200 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400">Status:</span>
              <select
                value={story.columnId}
                onChange={(e) => handleStoryStatusChange(story.id, e.target.value)}
                className="text-[11px] font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/80">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-1">
              <span>Tasks & Bugs</span>
              <span className="font-bold">
                {doneCount}/{totalCount} Completed
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isDoneState ? 'bg-emerald-500' : 'bg-blue-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 flex gap-4 p-3 overflow-x-auto items-start min-h-[140px]">
          {columns.map((col) => {
            const colWorkItems = workItems.filter((w) => w.columnId === col.id)
            const dropId = `${story.id}::${col.id}`

            return (
              <div
                key={col.id}
                className="w-72 shrink-0 rounded-lg bg-slate-100/70 p-2 border border-slate-200 min-h-[110px]"
              >
                <Droppable droppableId={dropId}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-col gap-2 min-h-[90px] p-1 rounded transition-colors ${
                        snapshot.isDraggingOver ? 'bg-blue-100/60 ring-2 ring-blue-400/40' : ''
                      }`}
                    >
                      {colWorkItems.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => handleOpenDrawer(item.key)}
                              className={`rounded-md border bg-white p-2.5 shadow-sm transition-all select-none cursor-pointer ${
                                item.type === 'BUG'
                                  ? 'border-red-200 hover:border-red-400'
                                  : 'border-slate-200 hover:border-blue-400'
                              } ${
                                snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500/20 rotate-1' : 'hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span
                                  className={`font-mono text-[11px] font-bold flex items-center gap-1 ${
                                    item.type === 'BUG' ? 'text-red-700' : 'text-slate-700'
                                  }`}
                                >
                                  <IssueTypeIcon type={item.type} />
                                  {item.key}
                                </span>
                                <PriorityIcon priority={item.priority} />
                              </div>

                              <p className="text-xs text-slate-800 font-medium leading-snug">
                                {item.title}
                              </p>

                              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1 text-[10px]">
                                {item.storyPoints ? (
                                  <span className="font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {item.storyPoints} pts
                                  </span>
                                ) : (
                                  <span />
                                )}
                                {item.assignee && (
                                  <span className="text-slate-500 font-medium">
                                    {item.assignee.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {colWorkItems.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex h-16 items-center justify-center rounded border border-dashed border-slate-300 text-[10px] text-slate-400">
                          Drop task or bug here
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Live Presence & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tickets by title or key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="EPIC">Epic</option>
              <option value="FEATURE">Feature</option>
              <option value="STORY">Story</option>
              <option value="TASK">Task</option>
              <option value="BUG">Bug</option>
            </select>
          </div>
        </div>

        {/* Live Collaborators Online Indicator */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>Live Sync</span>
          </div>

          <div className="flex items-center -space-x-1.5" title="Connected Collaborators">
            {activeCollaborators.map((c) => (
              <div
                key={c.userId}
                className="relative group"
                title={c.name}
              >
                {c.avatarUrl ? (
                  <img
                    src={c.avatarUrl}
                    alt={c.name}
                    className="w-6 h-6 rounded-full border-2 border-white object-cover shadow-xs"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-xs">
                    {c.name?.[0] ?? 'U'}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Board Column Header Row */}
      <div className="flex gap-4 overflow-x-auto items-center px-1">
        <div className="w-full lg:w-80 shrink-0 px-3 py-2 bg-slate-200/80 rounded font-bold text-xs uppercase tracking-wider text-slate-700">
          User Story / Requirements
        </div>
        {columns.map((column) => (
          <div
            key={column.id}
            className="w-72 shrink-0 flex items-center justify-between px-3 py-2 bg-slate-200/80 rounded font-bold text-xs uppercase tracking-wider text-slate-700"
          >
            <span>{column.name}</span>
          </div>
        ))}
      </div>

      {/* Main Drag-Drop Board Canvas */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="space-y-6">
          {/* Epics */}
          {hierarchyTree.epics.map((epic) => {
            const isCollapsed = !!collapsedEpics[epic.id]
            const childFeaturesOrStories = hierarchyTree.featuresByEpic.get(epic.id) || []

            return (
              <div
                key={epic.id}
                className="rounded-xl border-2 border-purple-200 bg-white shadow-sm overflow-hidden"
              >
                <div
                  onClick={() => toggleEpic(epic.id)}
                  className="flex items-center justify-between px-4 py-3 bg-purple-50/70 border-b border-purple-100 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <button type="button" className="text-purple-700">
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <IssueTypeIcon type="EPIC" />
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenDrawer(epic.key)
                      }}
                      className="font-mono text-xs font-bold text-purple-700 hover:underline"
                    >
                      {epic.key}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{epic.title}</span>
                  </div>
                  <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">
                    Epic
                  </span>
                </div>

                {!isCollapsed && (
                  <div>
                    {childFeaturesOrStories.map((featOrStory) => {
                      if (featOrStory.type === 'FEATURE') {
                        const stories = hierarchyTree.storiesByFeature.get(featOrStory.id) || []
                        return (
                          <div key={featOrStory.id} className="border-b border-slate-200">
                            <div className="px-6 py-2 bg-amber-50/50 border-b border-amber-100 flex items-center gap-2 text-xs">
                              <IssueTypeIcon type="FEATURE" />
                              <span
                                onClick={() => handleOpenDrawer(featOrStory.key)}
                                className="font-mono font-bold text-amber-700 hover:underline cursor-pointer"
                              >
                                {featOrStory.key}
                              </span>
                              <span className="font-semibold text-slate-700">
                                {featOrStory.title}
                              </span>
                            </div>
                            {stories.map((story) => renderStorySwimlane(story))}
                          </div>
                        )
                      }
                      return renderStorySwimlane(featOrStory)
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Standalone Features */}
          {hierarchyTree.features
            .filter((f) => !f.parentId)
            .map((feature) => {
              const stories = hierarchyTree.storiesByFeature.get(feature.id) || []
              return (
                <div
                  key={feature.id}
                  className="rounded-xl border-2 border-amber-200 bg-white shadow-sm overflow-hidden"
                >
                  <div className="px-4 py-2.5 bg-amber-50/70 border-b border-amber-100 flex items-center gap-2 text-xs">
                    <IssueTypeIcon type="FEATURE" />
                    <span
                      onClick={() => handleOpenDrawer(feature.key)}
                      className="font-mono font-bold text-amber-700 hover:underline cursor-pointer"
                    >
                      {feature.key}
                    </span>
                    <span className="font-bold text-slate-800">{feature.title}</span>
                    <span className="text-[10px] uppercase font-bold text-amber-600 ml-auto">
                      Feature
                    </span>
                  </div>
                  <div>{stories.map((story) => renderStorySwimlane(story))}</div>
                </div>
              )
            })}

          {/* Standalone Stories */}
          {hierarchyTree.standaloneStories.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wide">
                User Stories
              </div>
              <div>{hierarchyTree.standaloneStories.map((story) => renderStorySwimlane(story))}</div>
            </div>
          )}

          {/* Independent Tasks & Bugs */}
          {hierarchyTree.independentWorkItems.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                Independent Tasks & Bugs (Drag directly into any Story above to link)
              </div>
              <div className="flex gap-4 overflow-x-auto">
                {columns.map((col) => {
                  const items = hierarchyTree.independentWorkItems.filter((i) => i.columnId === col.id)
                  const dropId = `orphan::${col.id}`

                  return (
                    <div
                      key={col.id}
                      className="w-72 shrink-0 rounded-lg bg-slate-100 p-2 border border-slate-200 min-h-[100px]"
                    >
                      <Droppable droppableId={dropId}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex flex-col gap-2 min-h-[80px] p-1 rounded transition-colors ${
                              snapshot.isDraggingOver ? 'bg-slate-200/60' : ''
                            }`}
                          >
                            {items.map((item, index) => (
                              <Draggable key={item.id} draggableId={item.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => handleOpenDrawer(item.key)}
                                    className={`rounded border bg-white p-2.5 shadow-sm text-xs cursor-pointer ${
                                      item.type === 'BUG'
                                        ? 'border-red-200 hover:border-red-400'
                                        : 'border-slate-200 hover:border-blue-400'
                                    } ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500/20 rotate-1' : ''}`}
                                  >
                                    <div className="flex items-center justify-between font-mono text-[11px] font-bold mb-1">
                                      <span
                                        className={`flex items-center gap-1 ${
                                          item.type === 'BUG' ? 'text-red-700' : 'text-slate-700'
                                        }`}
                                      >
                                        <IssueTypeIcon type={item.type} />
                                        {item.key}
                                      </span>
                                      <PriorityIcon priority={item.priority} />
                                    </div>
                                    <p className="font-medium text-slate-800 leading-snug">
                                      {item.title}
                                    </p>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}

                            {items.length === 0 && !snapshot.isDraggingOver && (
                              <div className="flex h-14 items-center justify-center rounded border border-dashed border-slate-300 text-[10px] text-slate-400">
                                Empty
                              </div>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </DragDropContext>

      {/* Slide-out Drawer */}
      <IssueDetailDrawer
        issue={selectedIssue as any}
        allProjectIssues={issues as any}
        columns={columns.map((c) => ({ id: c.id, name: c.name }))}
        users={users}
        onClose={handleCloseDrawer}
        onNavigateIssue={(key) => handleOpenDrawer(key)}
      />
    </div>
  )
}

export default function KanbanBoard(props: KanbanBoardProps) {
  return (
    <Suspense fallback={<div className="text-xs text-slate-400">Loading live board...</div>}>
      <KanbanBoardContent {...props} />
    </Suspense>
  )
}