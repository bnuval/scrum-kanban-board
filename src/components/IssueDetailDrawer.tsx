'use client'

import { useState, useEffect } from 'react'
import { X, Send, MessageSquare, Lock, Save, CheckCircle2, Share2, Check } from 'lucide-react'
import { updateIssueDetails, addComment } from '@/app/actions'
import { IssuePriority } from '@prisma/client'

interface UserOption {
  id: string
  name: string | null
  avatarUrl: string | null
}

interface ColumnOption {
  id: string
  name: string
}

interface IssueDetailDrawerProps {
  issue: any
  allProjectIssues?: any[]
  columns: ColumnOption[]
  users?: UserOption[]
  isReadOnly?: boolean
  onClose: () => void
  onNavigateIssue?: (key: string) => void
}

export default function IssueDetailDrawer({
  issue,
  columns,
  users = [],
  isReadOnly = false,
  onClose,
}: IssueDetailDrawerProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<IssuePriority>('MEDIUM')
  const [columnId, setColumnId] = useState('')
  const [storyPoints, setStoryPoints] = useState<number | ''>('')
  const [assigneeId, setAssigneeId] = useState<string>('')

  const [commentText, setCommentText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (issue) {
      setTitle(issue.title || '')
      setDescription(issue.description || '')
      setPriority(issue.priority || 'MEDIUM')
      setColumnId(issue.columnId || columns[0]?.id || '')
      setStoryPoints(issue.storyPoints !== null && issue.storyPoints !== undefined ? issue.storyPoints : '')
      setAssigneeId(issue.assigneeId || issue.assignee?.id || '')
    }
  }, [issue, columns])

  if (!issue) return null

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
    } catch (err: any) {
      console.error(err)
      alert('Error updating issue details')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return

    setIsSubmittingComment(true)
    try {
      const res = await addComment(issue.id, commentText.trim())
      if (res.success) {
        setCommentText('')
      } else {
        alert(res.error || 'Failed to add comment')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmittingComment(false)
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            {issue.key}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 uppercase">
            {issue.type}
          </span>
          {isReadOnly ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              <Lock className="w-3 h-3" /> Read-Only
            </span>
          ) : (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Editable
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            title="Copy ticket URL"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Share</span>
              </>
            )}
          </button>

          {!isReadOnly && (
            <button
              type="button"
              onClick={() => handleSaveChanges()}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
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

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Form Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Summary / Title
          </label>
          {isReadOnly ? (
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Issue title"
              className="w-full text-sm font-semibold text-slate-900 border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Description
          </label>
          {isReadOnly ? (
            <div className="text-xs text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-lg border border-slate-200 min-h-[80px]">
              {description || 'No description provided.'}
            </div>
          ) : (
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, acceptance criteria, or logs..."
              className="w-full text-xs text-slate-800 border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Status</label>
            {isReadOnly ? (
              <span className="font-semibold text-slate-800">
                {columns.find((c) => c.id === columnId)?.name || 'None'}
              </span>
            ) : (
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
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
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Priority</label>
            {isReadOnly ? (
              <span className="font-semibold text-slate-800">{priority}</span>
            ) : (
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as IssuePriority)}
                className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
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
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Story Points</label>
            {isReadOnly ? (
              <span className="font-semibold text-slate-800">{storyPoints === '' ? '-' : `${storyPoints} pts`}</span>
            ) : (
              <input
                type="number"
                min="0"
                max="100"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Pts"
                className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs font-semibold text-slate-700 focus:outline-none"
              />
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Assignee</label>
            {isReadOnly ? (
              <span className="font-semibold text-slate-800">
                {users.find((u) => u.id === assigneeId)?.name || 'Unassigned'}
              </span>
            ) : (
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
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

        {/* Comments */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <MessageSquare className="w-4 h-4 text-blue-600" /> Comments & Activity
          </div>

          <form onSubmit={handlePostComment} className="space-y-2">
            <textarea
              rows={2}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Leave feedback or reply..."
              className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isSubmittingComment || !commentText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold cursor-pointer transition"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmittingComment ? 'Posting...' : 'Add Comment'}
            </button>
          </form>

          <div className="space-y-3">
            {(issue.comments || []).map((c: any) => (
              <div key={c.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                  <span>{c.user?.name || 'Member'}</span>
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-slate-800">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}