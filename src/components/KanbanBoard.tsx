'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
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
  ChevronDown,
  ChevronRight,
  CheckCheck,
  FolderTree,
  Radio,
  Lock,
} from 'lucide-react'
import { updateIssuePosition, updateIssueParent } from '@/app/actions'
import { supabase } from '@/lib/supabaseClient'
import IssueDetailDrawer from '@/components/IssueDetailDrawer'

interface KanbanBoardProps {
  columns: { id: string; name: string; order: number }[]
  allIssues: any[]
  users?: any[]
  currentUserId?: string
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

function KanbanBoardContent({
  columns,
  allIssues: initialIssues,
  users = [],
  currentUserId,
  isReadOnly = false,
}: KanbanBoardProps) {
  const router = useRouter()
  const [issues, setIssues] = useState<any[]>(initialIssues)
  const [collapsedEpics, setCollapsedEpics] = useState<Record<string, boolean>>({})
  const [isMounted, setIsMounted] = useState(false)
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setIssues(initialIssues)
  }, [initialIssues])

  const selectedIssue = useMemo(() => {
    if (!selectedIssueKey) return null
    return issues.find((i) => i.key.toUpperCase() === selectedIssueKey.toUpperCase()) || null
  }, [selectedIssueKey, issues])

  const handleOpenDrawer = (key: string) => setSelectedIssueKey(key)
  const handleCloseDrawer = () => setSelectedIssueKey(null)

  const doneCol = useMemo(
    () => columns.find((c) => c.name.toLowerCase() === 'done'),
    [columns]
  )

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesSearch =
        issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.key.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = typeFilter === 'ALL' || issue.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [issues, searchQuery, typeFilter])

  const hierarchyTree = useMemo(() => {
    const issueMap = new Map<string, any>()
    issues.forEach((i) => issueMap.set(i.id, i))

    const epics = issues.filter((i) => i.type === 'EPIC')
    const features = issues.filter((i) => i.type === 'FEATURE')
    const stories = issues.filter((i) => i.type === 'STORY')

    const storiesByFeature = new Map<string, any[]>()
    const featuresByEpic = new Map<string, any[]>()
    const standaloneStories: any[] = []

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

    const workItemsByStory = new Map<string, any[]>()
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

  const onDragEnd = (result: DropResult) => {
    if (isReadOnly) return
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const [destStoryId, destColumnId] = destination.droppableId.split('::')
    const targetParentId = destStoryId === 'orphan' ? null : destStoryId

    let updatedList = issues.map((item) =>
      item.id === draggableId
        ? { ...item, columnId: destColumnId, parentId: targetParentId }
        : item
    )

    setIssues(updatedList)
    updateIssuePosition(draggableId, destColumnId, destination.index + 1, targetParentId).catch(console.error)
  }

  if (!isMounted) return null

  const renderStorySwimlane = (story: any) => {
    const workItems = hierarchyTree.workItemsByStory.get(story.id) || []
    const totalCount = workItems.length
    const doneCount = doneCol ? workItems.filter((w) => w.columnId === doneCol.id).length : 0
    const isDoneState = doneCol && story.columnId === doneCol.id

    return (
      <div
        key={story.id}
        className={`flex flex-col lg:flex-row border-b border-slate-200 bg-white ${
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
              <PriorityIcon priority={story.priority} />
            </div>

            <p
              onClick={() => handleOpenDrawer(story.key)}
              className="text-xs font-semibold text-slate-900 leading-snug cursor-pointer hover:text-blue-600 transition"
            >
              {story.title}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] text-slate-500 font-medium flex justify-between">
            <span>Work Items</span>
            <span className="font-bold text-slate-700">
              {doneCount}/{totalCount} Done
            </span>
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
                <Droppable droppableId={dropId} isDropDisabled={isReadOnly}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-col gap-2 min-h-[90px] p-1 rounded ${
                        snapshot.isDraggingOver ? 'bg-blue-100/60' : ''
                      }`}
                    >
                      {colWorkItems.map((item, index) => (
                        <Draggable
                          key={item.id}
                          draggableId={item.id}
                          index={index}
                          isDragDisabled={isReadOnly}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => handleOpenDrawer(item.key)}
                              className={`rounded-md border bg-white p-2.5 shadow-xs select-none cursor-pointer ${
                                item.type === 'BUG' ? 'border-red-200' : 'border-slate-200'
                              } ${snapshot.isDragging ? 'shadow-lg rotate-1' : ''}`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-[11px] font-bold flex items-center gap-1 text-slate-700">
                                  <IssueTypeIcon type={item.type} />
                                  {item.key}
                                </span>
                                <PriorityIcon priority={item.priority} />
                              </div>
                              <p className="text-xs text-slate-800 font-medium">{item.title}</p>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
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
      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
          <Lock className="w-4 h-4 shrink-0" />
          You are viewing another team's board in Read-Only Mode. You can inspect tickets and participate by leaving comments.
        </div>
      )}

      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none"
          />
        </div>

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

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="space-y-6">
          {hierarchyTree.epics.map((epic) => (
            <div key={epic.id} className="rounded-xl border border-purple-200 bg-white overflow-hidden">
              <div
                onClick={() => setCollapsedEpics((prev) => ({ ...prev, [epic.id]: !prev[epic.id] }))}
                className="flex items-center justify-between px-4 py-2.5 bg-purple-50/70 border-b border-purple-100 cursor-pointer"
              >
                <div className="flex items-center gap-2">
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
              </div>
              {!collapsedEpics[epic.id] && (
                <div>
                  {(hierarchyTree.featuresByEpic.get(epic.id) || []).map((feat) =>
                    renderStorySwimlane(feat)
                  )}
                </div>
              )}
            </div>
          ))}

          {hierarchyTree.standaloneStories.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase">
                User Stories
              </div>
              <div>{hierarchyTree.standaloneStories.map((story) => renderStorySwimlane(story))}</div>
            </div>
          )}

          {hierarchyTree.independentWorkItems.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold text-slate-600 uppercase mb-2">
                Independent Tasks & Bugs
              </div>
              <div className="flex gap-4 overflow-x-auto">
                {columns.map((col) => {
                  const items = hierarchyTree.independentWorkItems.filter((i) => i.columnId === col.id)
                  const dropId = `orphan::${col.id}`

                  return (
                    <div key={col.id} className="w-72 shrink-0 rounded-lg bg-slate-100 p-2 border border-slate-200">
                      <Droppable droppableId={dropId} isDropDisabled={isReadOnly}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-2 min-h-[80px]">
                            {items.map((item, index) => (
                              <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={isReadOnly}>
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => handleOpenDrawer(item.key)}
                                    className="rounded border bg-white p-2.5 text-xs cursor-pointer shadow-xs"
                                  >
                                    <div className="flex justify-between font-mono text-[11px] font-bold">
                                      <span>{item.key}</span>
                                      <PriorityIcon priority={item.priority} />
                                    </div>
                                    <p className="mt-1 font-medium">{item.title}</p>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
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

      <IssueDetailDrawer
        issue={selectedIssue as any}
        allProjectIssues={issues as any}
        columns={columns.map((c) => ({ id: c.id, name: c.name }))}
        users={users}
        isReadOnly={isReadOnly}
        onClose={handleCloseDrawer}
        onNavigateIssue={(key) => handleOpenDrawer(key)}
      />
    </div>
  )
}

export default function KanbanBoard(props: KanbanBoardProps) {
  return (
    <Suspense fallback={<div className="text-xs text-slate-400">Loading board...</div>}>
      <KanbanBoardContent {...props} />
    </Suspense>
  )
}