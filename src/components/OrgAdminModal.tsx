'use client'

import { useState } from 'react'
import { provisionTeamMemberAction, createProjectBoardAction } from '@/app/auth-actions'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'

interface ProjectOption {
  id: string
  name: string
  key: string
}

export default function OrgAdminModal({ projects = [] }: { projects: ProjectOption[] }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState<'users' | 'boards'>('users')

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'DEV' | 'QA' | 'PO' | 'SM'>('DEV')
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '')

  const [boardName, setBoardName] = useState('')
  const [boardKey, setBoardKey] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const targetProj = selectedProjectId || projects[0]?.id
    if (!targetProj) {
      setError('Please create a project board first before adding team members.')
      return
    }

    const res = await provisionTeamMemberAction({
      username,
      email,
      name,
      password,
      role,
      projectId: targetProj,
    })

    if (res.success) {
      setUsername('')
      setEmail('')
      setName('')
      setPassword('')
      setMessage(`Added ${role} aligned to the selected team board!`)
      setTimeout(() => setMessage(''), 3000)
      router.refresh()
    } else {
      setError(res.error || 'Failed to create user')
    }
  }

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await createProjectBoardAction(boardName, boardKey)
    if (res.success) {
      setBoardName('')
      setBoardKey('')
      setMessage('New Project Board initialized!')
      setTimeout(() => {
        setMessage('')
        setIsOpen(false)
      }, 1500)
      router.refresh()
    } else {
      setError(res.error || 'Failed to create board')
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer"
      >
        <UserPlus className="w-3.5 h-3.5" /> Team & Boards
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex gap-4 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTab('users')}
              className={`pb-1 cursor-pointer ${tab === 'users' ? 'border-b-2 border-emerald-600 text-emerald-700' : 'text-slate-500'}`}
            >
              Provision Team (PO/SM/Dev/QA)
            </button>
            <button
              type="button"
              onClick={() => setTab('boards')}
              className={`pb-1 cursor-pointer ${tab === 'boards' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500'}`}
            >
              Create New Board
            </button>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {message && <div className="mb-3 text-xs font-bold text-emerald-600 bg-emerald-50 p-2 rounded">{message}</div>}
        {error && <div className="mb-3 text-xs font-bold text-red-600 bg-red-50 p-2 rounded">{error}</div>}

        {tab === 'users' ? (
          <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="p-2 border rounded border-slate-300"
              />
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="p-2 border rounded border-slate-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="p-2 border rounded border-slate-300"
              />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="p-2 border rounded border-slate-300"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1 font-semibold">Assign to Team Board</label>
              <select
                value={selectedProjectId || (projects[0]?.id ?? '')}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full p-2 border rounded border-slate-300 font-semibold"
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1 font-semibold">Select Member Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full p-2 border rounded border-slate-300"
              >
                <option value="DEV">Developer (Full edit on team board)</option>
                <option value="QA">Quality Assurance (Log Bugs & verify on team board)</option>
                <option value="PO">Product Owner (Sprint prioritization on team board)</option>
                <option value="SM">Scrum Master (Manage Sprints on team board)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded cursor-pointer"
            >
              Add Member to Organization
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreateBoard} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Board / Project Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Payments ART"
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                className="w-full p-2 border rounded border-slate-300"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Project Key (Prefix for tickets)</label>
              <input
                type="text"
                required
                placeholder="e.g. PAY"
                value={boardKey}
                onChange={(e) => setBoardKey(e.target.value)}
                className="w-full p-2 border rounded border-slate-300 uppercase"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded cursor-pointer"
            >
              Initialize Board
            </button>
          </form>
        )}
      </div>
    </div>
  )
}