import { getSession } from '@/lib/auth'
import LandingPage from '@/components/LandingPage'
import KanbanBoard from '@/components/KanbanBoard'
import BacklogView from '@/components/BacklogView'
import SprintReportsView from '@/components/SprintReportsView'
import PIPlanningView from '@/components/PIPlanningView'
import CreateIssueModal from '@/components/CreateIssueModal'
import OrgAdminModal from '@/components/OrgAdminModal'
import BoardSidebar from '@/components/BoardSidebar'
import SprintHeader from '@/components/SprintHeader'
import Link from 'next/link'
import { LayoutGrid, ListTodo, BarChart3, CalendarRange, LogOut, Shield, Eye, FolderPlus } from 'lucide-react'
import { logoutAction } from '@/app/auth-actions'
import { prisma } from '@/lib/prisma'
import { IssueType } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ view?: string; selectedIssue?: string; projectId?: string }>
}

export default async function ScrumProjectPage({ searchParams }: PageProps) {
  let session = null

  try {
    session = await getSession()
  } catch (error) {
    console.error('Session retrieval error:', error)
  }

  if (!session) {
    return <LandingPage />
  }

  const params = await searchParams
  const activeView =
    params.view === 'backlog'
      ? 'backlog'
      : params.view === 'reports'
      ? 'reports'
      : params.view === 'pi-planning'
      ? 'pi-planning'
      : 'board'

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      projectMembers: true,
    },
  })

  const orgProjects = await prisma.project.findMany({
    where: session.orgId ? { organizationId: session.orgId } : undefined,
    select: { id: true, key: true, name: true },
    orderBy: { createdAt: 'asc' },
  })

  const requestedProjectId = params.projectId
  const activeProjectId =
    requestedProjectId ||
    currentUser?.defaultProjectId ||
    orgProjects[0]?.id

  let project = null
  if (activeProjectId) {
    project = await prisma.project.findUnique({
      where: { id: activeProjectId },
      include: {
        sprints: { orderBy: { createdAt: 'asc' } },
        columns: { orderBy: { order: 'asc' } },
        members: { include: { user: true } },
      },
    })
  }

  if (!project && orgProjects.length > 0) {
    project = await prisma.project.findFirst({
      where: session.orgId ? { organizationId: session.orgId } : undefined,
      include: {
        sprints: { orderBy: { createdAt: 'asc' } },
        columns: { orderBy: { order: 'asc' } },
        members: { include: { user: true } },
      },
    })
  }

  const isPrivilegedAdmin = session.systemRole === 'SUPER_ADMIN' || session.orgRole === 'ORG_ADMIN'
  const isAssignedMember =
    currentUser?.defaultProjectId === project?.id ||
    currentUser?.projectMembers.some((pm) => pm.projectId === project?.id) ||
    project?.members.some((m) => m.userId === session.userId)

  const isReadOnly = !isPrivilegedAdmin && !isAssignedMember

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

  // Fetch all features scoped to the organization for SAFe PI Planning & Program Board
  const piFeatures = await prisma.issue.findMany({
    where: {
      type: IssueType.FEATURE,
      project: session.orgId ? { organizationId: session.orgId } : undefined,
    },
    include: {
      planBaselines: { orderBy: { createdAt: 'desc' }, take: 1 },
      children: true,
    },
    orderBy: { createdAt: 'asc' },
  })

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

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      {/* Team Navigation Sidebar with Search */}
      <BoardSidebar
        projects={orgProjects}
        currentProjectId={project?.id || ''}
        userDefaultProjectId={currentUser?.defaultProjectId}
        userRole={session.orgRole || session.systemRole}
      />

      {/* Main Workspace */}
      <main className="flex-1 min-w-0 p-6 md:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {session.orgRole || session.systemRole}
              </span>
              <span>/</span>
              <span>{project?.key || 'BOARD'}</span>
              {isReadOnly && (
                <span className="flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 normal-case text-[11px]">
                  <Eye className="w-3.5 h-3.5" /> Read-Only Mode
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {project?.name || 'Agile Delivery Workspace'}
            </h1>
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

            {session.orgRole === 'ORG_ADMIN' && (
              <OrgAdminModal projects={orgProjects} />
            )}

            {project && (
              <div className="flex bg-slate-200/80 p-1 rounded-lg">
                <Link
                  href={`?projectId=${project.id}&view=board`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    activeView === 'board' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Active Board
                </Link>

                <Link
                  href={`?projectId=${project.id}&view=backlog`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    activeView === 'backlog' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ListTodo className="w-3.5 h-3.5" />
                  Backlog
                </Link>

                <Link
                  href={`?projectId=${project.id}&view=pi-planning`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    activeView === 'pi-planning' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  PI Planning
                </Link>

                <Link
                  href={`?projectId=${project.id}&view=reports`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    activeView === 'reports' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Reports
                </Link>
              </div>
            )}

            {!isReadOnly && project && (
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

        {!project ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-slate-300 text-center space-y-4 max-w-xl mx-auto mt-12">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
              <FolderPlus className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">No Projects Configured</h3>
              <p className="text-xs text-slate-500 mt-1">
                Your organization does not have an active board yet. Use the Team &amp; Boards modal to initialize one.
              </p>
            </div>
            {session.systemRole === 'SUPER_ADMIN' && (
              <Link
                href="/admin"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold"
              >
                Go to Super Admin Console
              </Link>
            )}
          </div>
        ) : (
          <>
            {activeView !== 'pi-planning' && (
              <SprintHeader
                projectId={project.id}
                activeSprint={activeSprint}
                totalIssues={boardIssues.length}
                completedIssues={completedCount}
              />
            )}

            {activeView === 'board' && (
              <KanbanBoard
                columns={project.columns}
                allIssues={boardIssues as any}
                users={allUsers}
                currentUserId={session.userId}
                isReadOnly={isReadOnly}
              />
            )}

            {activeView === 'backlog' && (
              <BacklogView
                projectId={project.id}
                sprints={project.sprints as any}
                allIssues={allIssues as any}
                columns={project.columns.map((c) => ({ id: c.id, name: c.name }))}
                isReadOnly={isReadOnly}
              />
            )}

            {activeView === 'pi-planning' && (
              <PIPlanningView
                features={piFeatures as any}
                teams={orgProjects}
                orgId={session.orgId || ''}
                isReadOnly={isReadOnly}
              />
            )}

            {activeView === 'reports' && (
              <SprintReportsView
                sprints={project.sprints as any}
                allIssues={allIssues as any}
                columns={project.columns}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}