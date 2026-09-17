'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, LayoutGrid, ChevronLeft, ChevronRight, Shield } from 'lucide-react'

interface ProjectItem {
  id: string
  key: string
  name: string
}

interface BoardSidebarProps {
  projects: ProjectItem[]
  currentProjectId: string
  userDefaultProjectId?: string | null
  userRole?: string
  orgName?: string
}

export default function BoardSidebar({
  projects,
  currentProjectId,
  userDefaultProjectId,
  userRole,
  orgName = 'Organization',
}: BoardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects
    const q = searchQuery.toLowerCase()
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)
    )
  }, [projects, searchQuery])

  return (
    <aside
      className={`h-screen sticky top-0 shrink-0 bg-slate-900 text-slate-300 border-r border-slate-800 transition-all duration-300 flex flex-col z-30 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <h2 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 truncate">
              {orgName}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">Team ART Boards</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer mx-auto"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="p-3 border-b border-slate-800/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search team boards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 bg-slate-800/60 border border-slate-700/80 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredProjects.map((project) => {
          const isActive = project.id === currentProjectId
          const isPrimary = project.id === userDefaultProjectId

          return (
            <Link
              key={project.id}
              href={`?projectId=${project.id}`}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              title={isCollapsed ? `${project.name} (${project.key})` : undefined}
            >
              <LayoutGrid className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              {!isCollapsed && (
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <span className="truncate">{project.name}</span>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {isPrimary && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        My Team
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-slate-400 uppercase">
                      {project.key}
                    </span>
                  </div>
                </div>
              )}
            </Link>
          )
        })}

        {filteredProjects.length === 0 && !isCollapsed && (
          <div className="p-4 text-center text-xs text-slate-500 italic">
            No boards found
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <Shield className="w-3.5 h-3.5 text-blue-400" /> {userRole || 'MEMBER'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {projects.length} {projects.length === 1 ? 'Board' : 'Boards'}
          </span>
        </div>
      )}
    </aside>
  )
}