import { getSession } from '@/lib/auth'
import LandingPage from '@/components/LandingPage'
import KanbanBoard from '@/components/KanbanBoard'
import BacklogView from '@/components/BacklogView'
import SprintReportsView from '@/components/SprintReportsView'
import CreateIssueModal from '@/components/CreateIssueModal'
import SprintHeader from '@/components/SprintHeader'
import Link from 'next/link'
import { LayoutGrid, ListTodo, BarChart3, LogOut, Shield } from 'lucide-react'
import { logoutAction } from '@/app/auth-actions'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ view?: string; selectedIssue?: string }>
}

export default async function ScrumProjectPage({ searchParams }: PageProps) {
  const session = await getSession()

  // Unauthenticated visitors land on the Login screen
  if (!session) {
    return <LandingPage />
  }

  const params = await searchParams
  const activeView =
    params.view === 'backlog'
      ? 'backlog'
      : params.view === 'reports'
      ? 'reports'
      : 'board'

  // Fetch project scoped to the user's organization
  const project = await prisma.project.findFirst({
    where: session.orgId ? { organizationId: session.orgId } : undefined,
    include: {
      sprints: { orderBy: { createdAt: 'asc' } },
      columns: { orderBy: { order: 'asc' } },
      members: { include: { user: true } },
    },
  })

  const allIssues = project
    ? await prisma.issue.findMany({
        where: { projectId: project.id },
        orderBy: { order: 'asc' },
        include: {
          column: { select: { name: true } },
          assignee: { select: { id: true, name: true, avatarUrl: true } },
        },
      })
    : []

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, avatarUrl: true },
  })

  const activeSprint = project?.sprints.find((s) => s.status === 'ACTIVE')
  const boardIssues = activeSprint
    ? allIssues.filter((i) => i.sprintId === activeSprint.id)
    : allIssues

  const doneCol = project?.columns.find((c) => c.name.toLowerCase() === 'done')
  const completedCount = doneCol
    ? boardIssues.filter((i) => i.columnId === doneCol.id).length
    : 0

  const canCreateIssues =
    session.systemRole === 'SUPER_ADMIN' ||
    session.orgRole === 'ORG_ADMIN' ||
    session.orgRole === 'PO' ||
    session.orgRole === 'SM'

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-800">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {session.orgRole || 'MEMBER'}
            </span>
            <span>/</span>
            <span>{project?.key || 'BOARD'}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{project?.name || 'Agile Delivery Board'}</h1>
        </div>

        <div className="flex items-center gap-3">
          {session.systemRole === 'SUPER_ADMIN' && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-purple-100 text-purple-700 hover:bg-purple-200 transition"
            >
              <Shield className="w-3.5 h-3.5" /> Super Admin
            </Link>
          )}

          <div className="flex bg-slate-200/80 p-1 rounded-lg">
            <Link
              href="?view=board"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeView === 'board' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Active Board
            </Link>

            <Link
              href="?view=backlog"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeView === 'backlog' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              Backlog
            </Link>

            <Link
              href="?view=reports"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeView === 'reports' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Reports
            </Link>
          </div>

          {canCreateIssues && project && (
            <CreateIssueModal
              projectId={project.id}
              columns={project.columns.map((c) => ({ id: c.id, name: c.name }))}
            />
          )}

          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1 p-2 text-xs font-semibold text-slate-500 hover:text-red-600 transition cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </header>

      {project && (
        <SprintHeader
          projectId={project.id}
          activeSprint={activeSprint}
          totalIssues={boardIssues.length}
          completedIssues={completedCount}
        />
      )}

      {project && activeView === 'board' && (
        <KanbanBoard
          columns={project.columns}
          allIssues={boardIssues as any}
          users={allUsers}
          currentUserId={session.userId}
        />
      )}

      {project && activeView === 'backlog' && (
        <BacklogView
          projectId={project.id}
          sprints={project.sprints as any}
          allIssues={allIssues as any}
          columns={project.columns.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}

      {project && activeView === 'reports' && (
        <SprintReportsView
          sprints={project.sprints as any}
          allIssues={allIssues as any}
          columns={project.columns}
        />
      )}
    </main>
  )
}