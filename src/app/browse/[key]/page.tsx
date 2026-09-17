import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import LandingPage from '@/components/LandingPage'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Lock,
  Layers,
  Sparkles,
  Bookmark,
  AlertCircle,
  CheckCircle2,
  Calendar,
  User,
  MessageSquare,
} from 'lucide-react'
import StandaloneIssueEditor from './StandaloneIssueEditor'

export const dynamic = 'force-dynamic'

interface BrowsePageProps {
  params: Promise<{ key: string }>
}

function IssueTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'EPIC':
      return <Layers className="w-4 h-4 text-purple-600 fill-purple-600" />
    case 'FEATURE':
      return <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
    case 'STORY':
      return <Bookmark className="w-4 h-4 text-green-600 fill-green-600" />
    case 'BUG':
      return <AlertCircle className="w-4 h-4 text-red-600 fill-red-600" />
    case 'TASK':
    default:
      return <CheckCircle2 className="w-4 h-4 text-sky-500" />
  }
}

export default async function BrowseIssuePage({ params }: BrowsePageProps) {
  const session = await getSession()
  if (!session) {
    return <LandingPage />
  }

  const { key } = await params
  const issueKey = decodeURIComponent(key).toUpperCase()

  const issue = await prisma.issue.findUnique({
    where: { key: issueKey },
    include: {
      project: {
        include: {
          columns: { orderBy: { order: 'asc' } },
        },
      },
      column: true,
      assignee: true,
      reporter: true,
      parent: true,
      comments: {
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!issue) {
    notFound()
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { projectMembers: true },
  })

  // Permission Logic
  const isPrivilegedAdmin =
    session.systemRole === 'SUPER_ADMIN' || session.orgRole === 'ORG_ADMIN'
  const isAssignedMember =
    currentUser?.defaultProjectId === issue.projectId ||
    currentUser?.projectMembers.some((pm) => pm.projectId === issue.projectId)

  const isReadOnly = !isPrivilegedAdmin && !isAssignedMember

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, avatarUrl: true },
  })

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      {/* Top Navbar */}
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href={`/?projectId=${issue.projectId}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {issue.project.name}</span>
          </Link>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <IssueTypeIcon type={issue.type} />
            <span className="font-mono text-xs font-bold text-slate-700">
              {issue.key}
            </span>
          </div>
        </div>

        {isReadOnly ? (
          <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
            <Lock className="w-3.5 h-3.5" /> Read-Only Mode
          </span>
        ) : (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            Full Edit Access
          </span>
        )}
      </header>

      {/* Standalone View Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-10">
        <StandaloneIssueEditor
          issue={issue}
          columns={issue.project.columns}
          users={allUsers}
          isReadOnly={isReadOnly}
        />
      </main>
    </div>
  )
}