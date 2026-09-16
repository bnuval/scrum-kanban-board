import { prisma } from '@/lib/prisma'
import KanbanBoard from '@/components/KanbanBoard'
import BacklogView from '@/components/BacklogView'
import SprintReportsView from '@/components/SprintReportsView'
import CreateIssueModal from '@/components/CreateIssueModal'
import SprintHeader from '@/components/SprintHeader'
import Link from 'next/link'
import { LayoutGrid, ListTodo, BarChart3 } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ view?: string; selectedIssue?: string }>
}

async function getBoardData() {
  const project = await prisma.project.findUnique({
    where: { key: 'SCRUM' },
    include: {
      members: { include: { user: true } },
      sprints: { orderBy: { createdAt: 'asc' } },
      columns: { orderBy: { order: 'asc' } },
    },
  })

  if (!project) return null

  const allIssues = await prisma.issue.findMany({
    where: { projectId: project.id },
    orderBy: { order: 'asc' },
    include: {
      assignee: true,
      column: { select: { name: true } },
      parent: { select: { id: true, key: true, title: true, type: true } },
      children: {
        orderBy: { createdAt: 'asc' },
        include: {
          assignee: true,
          parent: { select: { id: true, key: true, title: true, type: true } },
        },
      },
      outgoingLinks: {
        include: {
          target: { select: { id: true, key: true, title: true, type: true, isCompleted: true } },
        },
      },
      incomingLinks: {
        include: {
          source: { select: { id: true, key: true, title: true, type: true, isCompleted: true } },
        },
      },
      comments: {
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  const allUsers = await prisma.user.findMany()

  return { project, allUsers, allIssues }
}

export default async function ScrumProjectPage({ searchParams }: PageProps) {
  const params = await searchParams
  const activeView =
    params.view === 'backlog'
      ? 'backlog'
      : params.view === 'reports'
      ? 'reports'
      : 'board'

  const data = await getBoardData()

  if (!data || !data.project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        No active Scrum project found. Please run your seed script.
      </div>
    )
  }

  const { project, allUsers, allIssues } = data
  const activeSprint = project.sprints.find((s) => s.status === 'ACTIVE')

  // In the active board view, show only issues assigned to the active sprint (or all if no sprint is active)
  const boardIssues = activeSprint
    ? allIssues.filter((i) => i.sprintId === activeSprint.id)
    : allIssues

  const doneColumn = project.columns.find((col) => col.name.toLowerCase() === 'done')
  const completedCount = doneColumn
    ? boardIssues.filter((i) => i.columnId === doneColumn.id).length
    : 0

  const memberUsers = project.members.map((m) => m.user)
  const availableUsers = memberUsers.length > 0 ? memberUsers : allUsers

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Projects</span>
            <span>/</span>
            <span>{project.key}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{project.name}</h1>
        </div>

        {/* View Switcher: Board vs Backlog vs Reports */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-200/80 p-1 rounded-lg">
            <Link
              href="?view=board"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeView === 'board'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Active Board
            </Link>

            <Link
              href="?view=backlog"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeView === 'backlog'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              Backlog
            </Link>

            <Link
              href="?view=reports"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeView === 'reports'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Reports
            </Link>
          </div>

          <CreateIssueModal
            projectId={project.id}
            columns={project.columns.map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>
      </header>

      {/* Active Sprint Header Tracker */}
      <SprintHeader
        projectId={project.id}
        activeSprint={activeSprint}
        totalIssues={boardIssues.length}
        completedIssues={completedCount}
      />

      {/* Main Body View */}
      {activeView === 'board' && (
        <KanbanBoard
          columns={project.columns}
          allIssues={boardIssues as any}
          users={availableUsers}
          currentUserId={availableUsers[0]?.id}
        />
      )}

      {activeView === 'backlog' && (
        <BacklogView
          projectId={project.id}
          sprints={project.sprints as any}
          allIssues={allIssues as any}
          columns={project.columns.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}

      {activeView === 'reports' && (
        <SprintReportsView
          sprints={project.sprints as any}
          allIssues={allIssues as any}
          columns={project.columns}
        />
      )}
    </main>
  )
}