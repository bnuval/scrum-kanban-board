'use client'

import { useState, useEffect } from 'react'
import {
  X,
  MessageSquare,
  Send,
  Check,
  Link2,
  Maximize2,
  Plus,
  ArrowUpRight,
  GitPullRequest,
  CheckSquare,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  Layers,
  Sparkles,
  Trash2,
  FolderTree,
} from 'lucide-react'
import {
  updateIssueDetails,
  addComment,
  createChildIssue,
  toggleSubtaskCompletion,
  syncIssueLinks,
  updateIssueParent,
} from '@/app/actions'
import { IssuePriority, IssueType } from '@prisma/client'

interface RelatedIssue {
  id: string
  key: string
  title: string
  type: string
  isCompleted?: boolean
  assignee?: { name: string | null; avatarUrl: string | null } | null
}

interface StagedLink {
  id?: string
  key: string
  title?: string
  type?: string
  isNew?: boolean
  isRemoved?: boolean
}

interface UserOption {
  id: string
  name: string | null
  avatarUrl: string | null
}

interface IssueDetails {
  id: string
  key: string
  title: string
  description: string | null
  type: IssueType
  priority: string
  columnId: string
  storyPoints?: number | null
  parentId?: string | null
  parent?: RelatedIssue | null
  children?: RelatedIssue[]
  outgoingLinks?: { id: string; type: string; target: RelatedIssue }[]
  incomingLinks?: { id: string; type: string; source: RelatedIssue }[]
  assignee?: { id: string; name: string | null; avatarUrl: string | null } | null
  comments?: any[]
}

interface IssueDetailDrawerProps {
  issue: IssueDetails | null
  allProjectIssues?: IssueDetails[]
  columns: { id: string; name: string }[]
  users?: UserOption[]
  onClose: () => void
  onNavigateIssue: (key: string) => void
}

function IssueTypeIconSmall({ type }: { type: string }) {
  switch (type) {
    case 'EPIC':
      return <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />
    case 'FEATURE':
      return <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
    case 'STORY':
      return <Bookmark className="w-3.5 h-3.5 text-green-600 fill-green-600 shrink-0" />
    case 'BUG':
      return <AlertCircle className="w-3.5 h-3.5 text-red-600 fill-red-600 shrink-0" />
    case 'TASK':
    default:
      return <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
  }
}

export default function IssueDetailDrawer({
  issue,
  allProjectIssues = [],
  columns,
  users = [],
  onClose,
  onNavigateIssue,
}: IssueDetailDrawerProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<IssuePriority>(IssuePriority.MEDIUM)
  const [columnId, setColumnId] = useState('')
  const [storyPoints, setStoryPoints] = useState<number | ''>('')
  const [assigneeId, setAssigneeId] = useState('')
  const [parentId, setParentId] = useState<string>('')
  const [newComment, setNewComment] = useState('')
  const [newChildTitle, setNewChildTitle] = useState('')
  const [targetLinkKey, setTargetLinkKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [copied, setCopied] = useState(false)
  const [stagedLinks, setStagedLinks] = useState<StagedLink[]>([])

  useEffect(() => {
    if (issue) {
      setTitle(issue.title)
      setDescription(issue.description || '')
      setPriority(issue.priority as IssuePriority)
      setColumnId(issue.columnId)
      setStoryPoints(issue.storyPoints ?? '')
      setAssigneeId(issue.assignee?.id ?? '')
      setParentId(issue.parentId || '')
      setSaveSuccess(false)
      setTargetLinkKey('')

      const existing: StagedLink[] = [
        ...(issue.outgoingLinks?.map((l) => ({
          id: l.id,
          key: l.target.key,
          title: l.target.title,
          type: l.target.type,
        })) || []),
        ...(issue.incomingLinks?.map((l) => ({
          id: l.id,
          key: l.source.key,
          title: l.source.title,
          type: l.source.type,
        })) || []),
      ]
      setStagedLinks(existing)
    }
  }, [issue])

  if (!issue) return null

  // Eligible parent candidates based on issue type:
  // - STORY can be tagged to FEATURE or EPIC
  // - BUG can be tagged to STORY, FEATURE, or EPIC
  // - TASK can be tagged to STORY or BUG
  // - FEATURE can be tagged to EPIC
  const eligibleParents = allProjectIssues.filter((p) => {
    if (p.id === issue.id) return false
    if (issue.type === 'STORY') return p.type === 'FEATURE' || p.type === 'EPIC'
    if (issue.type === 'BUG') return p.type === 'STORY' || p.type === 'FEATURE' || p.type === 'EPIC'
    if (issue.type === 'TASK') return p.type === 'STORY' || p.type === 'BUG'
    if (issue.type === 'FEATURE') return p.type === 'EPIC'
    return false
  })

  const canHaveChildren = issue.type !== IssueType.TASK
  const targetChildType =
    issue.type === IssueType.EPIC
      ? IssueType.FEATURE
      : issue.type === IssueType.FEATURE
      ? IssueType.STORY
      : IssueType.TASK

  const childTypeLabel =
    issue.type === IssueType.EPIC
      ? 'Feature'
      : issue.type === IssueType.FEATURE
      ? 'Story'
      : 'Task'

  const currentPoints = storyPoints === '' ? null : Number(storyPoints)
  const hasLinkChanges = stagedLinks.some((l) => l.isNew || l.isRemoved)

  const hasChanges =
    title !== issue.title ||
    description !== (issue.description || '') ||
    priority !== issue.priority ||
    columnId !== issue.columnId ||
    currentPoints !== (issue.storyPoints ?? null) ||
    assigneeId !== (issue.assignee?.id ?? '') ||
    parentId !== (issue.parentId || '') ||
    hasLinkChanges

  const handleStageAddLink = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanKey = targetLinkKey.trim().toUpperCase()
    if (!cleanKey || cleanKey === issue.key) return
    if (stagedLinks.some((l) => l.key === cleanKey && !l.isRemoved)) return

    setStagedLinks((prev) => [...prev, { key: cleanKey, isNew: true }])
    setTargetLinkKey('')
  }

  const handleStageRemoveLink = (linkItem: StagedLink) => {
    if (linkItem.isNew) {
      setStagedLinks((prev) => prev.filter((l) => l.key !== linkItem.key))
    } else {
      setStagedLinks((prev) =>
        prev.map((l) => (l.id === linkItem.id ? { ...l, isRemoved: true } : l))
      )
    }
  }

  const handleManualSave = async () => {
    if (!title.trim() || isSaving) return
    setIsSaving(true)

    // Save details and parent
    await updateIssueDetails({
      issueId: issue.id,
      title,
      description,
      priority,
      columnId,
      storyPoints: currentPoints,
      assigneeId: assigneeId || null,
      parentId: parentId || null,
    })

    // Sync links
    const keysToAdd = stagedLinks.filter((l) => l.isNew && !l.isRemoved).map((l) => l.key)
    const idsToRemove = stagedLinks.filter((l) => l.id && l.isRemoved).map((l) => l.id!)
    if (keysToAdd.length > 0 || idsToRemove.length > 0) {
      await syncIssueLinks(issue.id, keysToAdd, idsToRemove)
    }

    setIsSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChildTitle.trim() || !canHaveChildren) return

    await createChildIssue({
      parentId: issue.id,
      title: newChildTitle.trim(),
      childType: targetChildType,
    })
    setNewChildTitle('')
  }

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    await addComment(issue.id, newComment.trim())
    setNewComment('')
  }

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}/browse/${issue.key}`
    navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const activeLinks = stagedLinks.filter((l) => !l.isRemoved)
  const children = canHaveChildren ? issue.children || [] : []
  const completedChildren = children.filter((c) => c.isCompleted).length
  const childrenPercent = children.length > 0 ? (completedChildren / children.length) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]">
      <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 uppercase tracking-wide">
              {issue.key}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {issue.type}
            </span>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition"
            >
              <Link2 className="w-3.5 h-3.5" />
              {copied ? 'Copied!' : 'Copy Link'}
            </button>

            <a
              href={`/browse/${issue.key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Expand
            </a>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition p-1 rounded hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Parent Tagging Selector */}
          {eligibleParents.length > 0 && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <FolderTree className="w-4 h-4 text-slate-500" />
                <span>Parent Issue:</span>
              </div>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="flex-1 max-w-[280px] bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-blue-600"
              >
                <option value="">None (Independent Root)</option>
                {eligibleParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.key}] ({p.type}) {p.title.slice(0, 30)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-base font-semibold text-slate-900 border-b border-slate-200 focus:border-blue-600 focus:outline-none pb-1"
            />
          </div>

          {/* Attributes */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full bg-white rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-blue-600"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as IssuePriority)}
                className="w-full bg-white rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-blue-600"
              >
                <option value="LOWEST">Lowest</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="HIGHEST">Highest</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Story Points</label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 5"
                value={storyPoints}
                onChange={(e) =>
                  setStoryPoints(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                }
                className="w-full bg-white rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full bg-white rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-blue-600"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.id}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              placeholder="Add detailed description..."
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* Save Action Bar */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-lg">
            <span className="text-xs text-slate-500">
              {hasChanges ? 'You have unsaved changes' : 'All changes saved'}
            </span>
            <button
              onClick={handleManualSave}
              disabled={!hasChanges || isSaving}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Saved
                </>
              ) : isSaving ? (
                'Saving...'
              ) : (
                'Save Changes'
              )}
            </button>
          </div>

          {/* Children List */}
          {canHaveChildren && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <CheckSquare className="w-4 h-4 text-slate-500" />
                  Child {childTypeLabel}s ({completedChildren}/{children.length})
                </div>
                {children.length > 0 && (
                  <span className="text-[11px] font-semibold text-slate-500">
                    {Math.round(childrenPercent)}%
                  </span>
                )}
              </div>

              {children.length > 0 && (
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${childrenPercent}%` }}
                  />
                </div>
              )}

              <form onSubmit={handleAddChild} className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder={`Add new ${childTypeLabel.toLowerCase()}...`}
                  value={newChildTitle}
                  onChange={(e) => setNewChildTitle(e.target.value)}
                  className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs focus:outline-blue-600"
                />
                <button
                  type="submit"
                  className="bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-slate-900 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </form>

              {children.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {children.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center justify-between p-2 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-xs transition shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <input
                          type="checkbox"
                          checked={child.isCompleted}
                          onChange={() => toggleSubtaskCompletion(child.id, !child.isCompleted)}
                          className="rounded border-slate-300 text-blue-600 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => onNavigateIssue(child.key)}
                          className="flex items-center gap-1 font-mono text-[11px] font-bold text-blue-600 hover:underline shrink-0"
                        >
                          <IssueTypeIconSmall type={child.type} />
                          {child.key}
                        </button>
                        <span className={`truncate ${child.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          {child.title}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onNavigateIssue(child.key)}
                        className="text-[11px] text-slate-400 hover:text-blue-600 flex items-center gap-0.5 ml-2 shrink-0"
                      >
                        Open <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Linked Issues Section */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <GitPullRequest className="w-3.5 h-3.5 text-slate-500" />
              Linked Issues ({activeLinks.length})
            </span>

            <form onSubmit={handleStageAddLink} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Issue Key to link (e.g. SCRUM-2)..."
                value={targetLinkKey}
                onChange={(e) => setTargetLinkKey(e.target.value)}
                className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs focus:outline-blue-600 uppercase font-mono"
              />
              <button
                type="submit"
                className="bg-slate-100 text-slate-700 px-3.5 py-1.5 rounded-md text-xs font-semibold hover:bg-slate-200 transition"
              >
                Add Link
              </button>
            </form>

            <div className="space-y-1.5">
              {activeLinks.map((link) => (
                <div
                  key={link.id || link.key}
                  className={`flex items-center justify-between p-2 rounded-md border text-xs transition ${
                    link.isNew
                      ? 'bg-blue-50/60 border-blue-200 text-blue-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">
                      relates to
                    </span>
                    <button
                      type="button"
                      onClick={() => !link.isNew && onNavigateIssue(link.key)}
                      className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-blue-600 hover:underline shrink-0"
                    >
                      {link.type && <IssueTypeIconSmall type={link.type} />}
                      {link.key}
                    </button>
                    <span className="truncate max-w-[200px]">
                      {link.title ?? (link.isNew ? '(Pending Save)' : '')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStageRemoveLink(link)}
                    className="text-slate-400 hover:text-red-500 transition p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Activity / Comments */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              Activity & Comments
            </div>

            <form onSubmit={handleSendComment} className="flex gap-2">
              <input
                type="text"
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs focus:outline-blue-600"
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-blue-700 transition flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                Post
              </button>
            </form>

            <div className="space-y-3 pt-2">
              {issue.comments && issue.comments.length > 0 ? (
                issue.comments.map((comment: any) => (
                  <div key={comment.id} className="text-xs bg-slate-50 p-3 rounded-md border border-slate-100">
                    <div className="flex items-center justify-between text-slate-800 font-semibold mb-1">
                      <span>{comment.user?.name ?? 'User'}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-slate-600">{comment.body}</div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 italic py-2">No comments yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}