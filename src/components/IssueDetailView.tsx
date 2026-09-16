'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  MessageSquare,
  Send,
  Check,
  Link2,
  GitPullRequest,
  CheckSquare,
  Plus,
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  Layers,
  Sparkles,
  X,
} from 'lucide-react'
import {
  updateIssueDetails,
  addComment,
  createChildIssue,
  toggleSubtaskCompletion,
  linkIssues,
  removeIssueLink,
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

interface IssueLinkItem {
  id: string
  type: string
  issue: RelatedIssue
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
  project: { name: string; key: string }
  parent?: RelatedIssue | null
  children?: RelatedIssue[]
  outgoingLinks?: { id: string; type: string; target: RelatedIssue }[]
  incomingLinks?: { id: string; type: string; source: RelatedIssue }[]
  assignee?: { id: string; name: string | null; avatarUrl: string | null } | null
  comments?: any[]
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

export default function IssueDetailView({
  issue,
  columns,
}: {
  issue: IssueDetails
  columns: { id: string; name: string }[]
}) {
  const [title, setTitle] = useState(issue.title)
  const [description, setDescription] = useState(issue.description || '')
  const [priority, setPriority] = useState<IssuePriority>(issue.priority as IssuePriority)
  const [columnId, setColumnId] = useState(issue.columnId)
  const [storyPoints, setStoryPoints] = useState<number | ''>(issue.storyPoints ?? '')
  const [newComment, setNewComment] = useState('')
  const [newChildTitle, setNewChildTitle] = useState('')
  const [targetLinkKey, setTargetLinkKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [copied, setCopied] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  const [localChildren, setLocalChildren] = useState<RelatedIssue[]>(issue.children || [])
  const [localLinks, setLocalLinks] = useState<IssueLinkItem[]>([
    ...(issue.outgoingLinks?.map((l) => ({ id: l.id, type: l.type, issue: l.target })) || []),
    ...(issue.incomingLinks?.map((l) => ({ id: l.id, type: l.type, issue: l.source })) || []),
  ])

  useEffect(() => {
    setTitle(issue.title)
    setDescription(issue.description || '')
    setPriority(issue.priority as IssuePriority)
    setColumnId(issue.columnId)
    setStoryPoints(issue.storyPoints ?? '')
    setLocalChildren(issue.children || [])
    setLocalLinks([
      ...(issue.outgoingLinks?.map((l) => ({ id: l.id, type: l.type, issue: l.target })) || []),
      ...(issue.incomingLinks?.map((l) => ({ id: l.id, type: l.type, issue: l.source })) || []),
    ])
  }, [issue])

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
  const hasChanges =
    title !== issue.title ||
    description !== (issue.description || '') ||
    priority !== issue.priority ||
    columnId !== issue.columnId ||
    currentPoints !== (issue.storyPoints ?? null)

  const handleManualSave = async () => {
    if (!title.trim() || isSaving) return

    setIsSaving(true)
    const res = await updateIssueDetails({
      issueId: issue.id,
      title,
      description,
      priority,
      columnId,
      storyPoints: currentPoints,
      assigneeId: issue.assignee?.id || null,
    })
    setIsSaving(false)

    if (res.success) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    }
  }

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChildTitle.trim() || !canHaveChildren) return

    const res = await createChildIssue({
      parentId: issue.id,
      title: newChildTitle.trim(),
      childType: targetChildType,
    })

    if (res.success && res.issue) {
      setLocalChildren((prev) => [...prev, res.issue])
      setNewChildTitle('')
    }
  }

  const handleToggleChild = async (childId: string, currentStatus: boolean) => {
    setLocalChildren((prev) =>
      prev.map((c) => (c.id === childId ? { ...c, isCompleted: !currentStatus } : c))
    )
    await toggleSubtaskCompletion(childId, !currentStatus)
  }

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetLinkKey.trim()) return

    setLinkError(null)
    const res = await linkIssues(issue.id, targetLinkKey.trim())

    if (!res.success) {
      setLinkError(res.error || 'Failed to link issue')
    } else if (res.link) {
      setLocalLinks((prev) => [
        ...prev,
        { id: res.link.id, type: res.link.type, issue: res.link.target },
      ])
      setTargetLinkKey('')
    }
  }

  const handleRemoveLink = async (linkId: string) => {
    setLocalLinks((prev) => prev.filter((l) => l.id !== linkId))
    await removeIssueLink(linkId)
  }

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    await addComment(issue.id, newComment.trim())
    setNewComment('')
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const completedChildren = localChildren.filter((c) => c.isCompleted).length
  const childrenPercent =
    localChildren.length > 0 ? (completedChildren / localChildren.length) * 100 : 0

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 uppercase">
              {issue.key}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {issue.project.name}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {issue.type}
            </span>
          </div>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
          >
            <Link2 className="w-3.5 h-3.5" />
            {copied ? 'Link Copied!' : 'Copy Share Link'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            {issue.parent && (
              <div className="bg-sky-50/70 border border-sky-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">
                    Parent {issue.parent.type}
                  </span>
                  <Link
                    href={`/browse/${issue.parent.key}`}
                    className="font-mono text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
                  >
                    <IssueTypeIconSmall type={issue.parent.type} />
                    {issue.parent.key}
                  </Link>
                  <span className="text-xs text-slate-700 font-medium truncate max-w-[240px]">
                    {issue.parent.title}
                  </span>
                </div>
                <Link
                  href={`/browse/${issue.parent.key}`}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 shrink-0 ml-2"
                >
                  View Parent <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-lg font-bold text-slate-900 border-b border-slate-200 pb-1 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={6}
                  value={description}
                  placeholder="Add a detailed description..."
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-slate-200 p-3 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  {hasChanges ? 'Unsaved modifications pending' : 'All changes saved'}
                </span>
                <button
                  onClick={handleManualSave}
                  disabled={!hasChanges || isSaving}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition ${
                    saveSuccess
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Saved
                    </>
                  ) : isSaving ? (
                    'Saving...'
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-slate-500" />
                  Child {childTypeLabel}s ({completedChildren}/{localChildren.length})
                </span>
                {localChildren.length > 0 && (
                  <span className="text-xs font-semibold text-slate-500">
                    {Math.round(childrenPercent)}%
                  </span>
                )}
              </div>

              {localChildren.length > 0 && (
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${childrenPercent}%` }}
                  />
                </div>
              )}

              {canHaveChildren ? (
                <form onSubmit={handleAddChild} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`Add a new ${childTypeLabel.toLowerCase()}...`}
                    value={newChildTitle}
                    onChange={(e) => setNewChildTitle(e.target.value)}
                    className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-blue-600"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1 rounded-md bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </form>
              ) : (
                <div className="p-3 rounded bg-slate-50 text-xs text-slate-500 border border-slate-100">
                  Tasks cannot have child subtasks in this hierarchy.
                </div>
              )}

              <div className="space-y-2 pt-1">
                {localChildren.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between p-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition text-xs shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <input
                        type="checkbox"
                        checked={child.isCompleted}
                        onChange={() => handleToggleChild(child.id, !!child.isCompleted)}
                        className="rounded border-slate-300 text-blue-600 cursor-pointer"
                      />
                      <Link
                        href={`/browse/${child.key}`}
                        className="flex items-center gap-1 font-mono text-[11px] font-bold text-blue-600 hover:underline shrink-0"
                      >
                        <IssueTypeIconSmall type={child.type} />
                        {child.key}
                      </Link>
                      <Link
                        href={`/browse/${child.key}`}
                        className={`truncate hover:text-blue-600 transition text-left ${
                          child.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'
                        }`}
                      >
                        {child.title}
                      </Link>
                    </div>

                    <Link
                      href={`/browse/${child.key}`}
                      className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-0.5 shrink-0 ml-2"
                    >
                      Open <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-slate-500" />
                Linked Issues ({localLinks.length})
              </span>

              <form onSubmit={handleAddLink} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Issue Key to link (e.g. SCRUM-1)..."
                  value={targetLinkKey}
                  onChange={(e) => setTargetLinkKey(e.target.value)}
                  className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-blue-600 uppercase font-mono"
                />
                <button
                  type="submit"
                  className="rounded-md bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                >
                  Link
                </button>
              </form>

              {linkError && <p className="text-xs text-red-500">{linkError}</p>}

              <div className="space-y-2 pt-1">
                {localLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 border border-slate-200 text-xs hover:border-slate-300 transition"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">
                        relates to
                      </span>
                      <Link
                        href={`/browse/${link.issue.key}`}
                        className="inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-600 hover:underline shrink-0"
                      >
                        <IssueTypeIconSmall type={link.issue.type} />
                        {link.issue.key}
                      </Link>
                      <Link
                        href={`/browse/${link.issue.key}`}
                        className="text-slate-700 truncate hover:text-blue-600 transition text-left"
                      >
                        {link.issue.title}
                      </Link>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveLink(link.id)}
                      className="text-slate-400 hover:text-red-500 transition p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <MessageSquare className="w-4 h-4 text-slate-500" />
                Comments & Discussion
              </div>

              <form onSubmit={handleSendComment} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-blue-600"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
                >
                  <Send className="w-3 h-3" />
                  Post
                </button>
              </form>

              <div className="space-y-3 pt-2">
                {issue.comments && issue.comments.length > 0 ? (
                  issue.comments.map((comment: any) => (
                    <div
                      key={comment.id}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-3.5 text-xs"
                    >
                      <div className="flex items-center justify-between text-slate-800 font-semibold mb-1">
                        <span>{comment.user?.name ?? 'User'}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">{comment.body}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">No comments posted yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Ticket Details
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                <select
                  value={columnId}
                  onChange={(e) => setColumnId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-blue-600"
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
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-blue-600"
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
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Project</label>
                <div className="text-xs font-semibold text-slate-700">{issue.project.name}</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Assignee</label>
                <div className="flex items-center gap-2">
                  {issue.assignee?.avatarUrl ? (
                    <img
                      src={issue.assignee.avatarUrl}
                      alt={issue.assignee.name ?? 'Avatar'}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                      {issue.assignee?.name?.[0] ?? 'U'}
                    </div>
                  )}
                  <span className="text-xs text-slate-700">
                    {issue.assignee?.name ?? 'Unassigned'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}