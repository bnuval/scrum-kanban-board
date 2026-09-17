'use client'

import { useState } from 'react'
import {
  Save,
  CheckCircle2,
  Share2,
  Check,
  MessageSquare,
  Send,
} from 'lucide-react'
import { updateIssueDetails, addComment } from '@/app/actions'
import { IssuePriority } from '@prisma/client'

export default function StandaloneIssueEditor({
  issue,
  columns,
  users,
  isReadOnly,
}: {
  issue: any
  columns: { id: string; name: string }[]
  users: { id: string; name: string | null }[]
  isReadOnly: boolean
}) {
  const [title, setTitle] = useState(issue.title || '')
  const [description, setDescription] = useState(issue.description || '')
  const [priority, setPriority] = useState<IssuePriority>(issue.priority || 'MEDIUM')
  const [columnId, setColumnId] = useState(issue.columnId)
  const [storyPoints, setStoryPoints] = useState<number | ''>(
    issue.storyPoints ?? ''
  )
  const [assigneeId, setAssigneeId] = useState(issue.assigneeId || '')

  const [commentText, setCommentText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSaveChanges = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isReadOnly) return

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      const res = await updateIssueDetails({
        issueId: issue.id,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        columnId,
        storyPoints: storyPoints === '' ? null : Number(storyPoints),
        assigneeId: assigneeId || null,
      })

      if (res.success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2500)
      } else {
        alert(res.error || 'Failed to save changes')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return

    setIsPostingComment(true)
    try {
      const res = await addComment(issue.id, commentText.trim())
      if (res.success) {
        setCommentText('')
        window.location.reload()
      } else {
        alert(res.error || 'Failed to post comment')
      }
    } finally {
      setIsPostingComment(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8 space-y-8">
      {/* Top Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
            {issue.key}
          </span>
          <span className="ml-2 text-xs font-semibold text-slate-500 uppercase">
            {issue.type}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Share Link</span>
              </>
            )}
          </button>

          {!isReadOnly && (
            <button
              type="button"
              onClick={() => handleSaveChanges()}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> Saved
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> {isSaving ? 'Saving...' : 'Save Ticket'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Summary
            </label>
            {isReadOnly ? (
              <h1 className="text-xl font-bold text-slate-900 leading-snug">
                {title}
              </h1>
            ) : (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-base font-semibold text-slate-900 border border-slate-300 rounded-lg p-3 focus:outline-none focus:border-blue-500"
              />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Description
            </label>
            {isReadOnly ? (
              <div className="text-sm text-slate-700 whitespace-pre-wrap p-4 bg-slate-50 rounded-xl border border-slate-200 min-h-[120px] leading-relaxed">
                {description || 'No description provided.'}
              </div>
            ) : (
              <textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-sm text-slate-800 border border-slate-300 rounded-xl p-3.5 focus:outline-none focus:border-blue-500"
                placeholder="Detailed description, requirements, or acceptance criteria..."
              />
            )}
          </div>
        </div>

        {/* Sidebar Metadata Card */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4 text-xs self-start">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Status
            </label>
            {isReadOnly ? (
              <span className="font-semibold text-slate-800">
                {columns.find((c) => c.id === columnId)?.name || 'None'}
              </span>
            ) : (
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md p-2 font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Priority
            </label>
            {isReadOnly ? (
              <span className="font-semibold text-slate-800">{priority}</span>
            ) : (
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as IssuePriority)}
                className="w-full bg-white border border-slate-300 rounded-md p-2 font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="LOWEST">Lowest</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="HIGHEST">Highest</option>
              </select>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Story Points
            </label>
            {isReadOnly ? (
              <span className="font-semibold text-slate-800">
                {storyPoints === '' ? '-' : `${storyPoints} pts`}
              </span>
            ) : (
              <input
                type="number"
                min="0"
                max="100"
                value={storyPoints}
                onChange={(e) =>
                  setStoryPoints(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full bg-white border border-slate-300 rounded-md p-2 font-semibold text-slate-700 focus:outline-none"
              />
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Assignee
            </label>
            {isReadOnly ? (
              <span className="font-semibold text-slate-800">
                {users.find((u) => u.id === assigneeId)?.name || 'Unassigned'}
              </span>
            ) : (
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md p-2 font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || 'Member'}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Discussion / Comments Section */}
      <div className="pt-8 border-t border-slate-100 space-y-6">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span>Comments & Activity</span>
        </div>

        <form onSubmit={handlePostComment} className="space-y-3">
          <textarea
            rows={3}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment or reply to this ticket..."
            className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white"
          />
          <button
            type="submit"
            disabled={isPostingComment || !commentText.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            {isPostingComment ? 'Posting...' : 'Post Comment'}
          </button>
        </form>

        <div className="space-y-3">
          {issue.comments?.map((c: any) => (
            <div
              key={c.id}
              className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5"
            >
              <div className="flex justify-between items-center text-[11px] text-slate-400 font-semibold">
                <span className="text-slate-800 font-bold">
                  {c.user?.name || 'Member'}
                </span>
                <span>{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}