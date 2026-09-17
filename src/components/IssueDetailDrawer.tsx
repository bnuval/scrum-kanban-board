'use client'

import { useState } from 'react'
import { X, Send, MessageSquare, Lock } from 'lucide-react'
import { addComment } from '@/app/actions'

interface IssueDetailDrawerProps {
  issue: any
  allProjectIssues: any[]
  columns: { id: string; name: string }[]
  users?: any[]
  isReadOnly?: boolean
  onClose: () => void
  onNavigateIssue: (key: string) => void
}

export default function IssueDetailDrawer({
  issue,
  columns,
  isReadOnly = false,
  onClose,
}: IssueDetailDrawerProps) {
  const [commentText, setCommentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!issue) return null

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return

    setIsSubmitting(true)
    try {
      await addComment(issue.id, commentText.trim())
      setCommentText('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col">
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            {issue.key}
          </span>
          {isReadOnly && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              <Lock className="w-3 h-3" /> Read Only
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{issue.title}</h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
            {issue.description || 'No description provided.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
          <div>
            <span className="block text-slate-400 uppercase font-bold text-[10px]">Type</span>
            <span className="font-semibold text-slate-800">{issue.type}</span>
          </div>
          <div>
            <span className="block text-slate-400 uppercase font-bold text-[10px]">Priority</span>
            <span className="font-semibold text-slate-800">{issue.priority}</span>
          </div>
          <div>
            <span className="block text-slate-400 uppercase font-bold text-[10px]">Status</span>
            <span className="font-semibold text-slate-800">
              {columns.find((c) => c.id === issue.columnId)?.name || 'Default'}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 uppercase font-bold text-[10px]">Story Points</span>
            <span className="font-semibold text-slate-800">{issue.storyPoints ?? '-'}</span>
          </div>
        </div>

        {/* Discussion / Comments Section (Always enabled for collaboration) */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <MessageSquare className="w-4 h-4 text-blue-600" /> Comments & Activity
          </div>

          <form onSubmit={handlePostComment} className="space-y-2">
            <textarea
              rows={2}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Leave feedback or comment on this ticket..."
              className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isSubmitting || !commentText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold cursor-pointer transition"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Posting...' : 'Add Comment'}
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