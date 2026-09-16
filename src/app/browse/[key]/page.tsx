import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import IssueDetailView from '@/components/IssueDetailView'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ key: string }>
}

export default async function IssuePage({ params }: Props) {
  const { key } = await params

  const issue = await prisma.issue.findFirst({
    where: {
      key: {
        equals: key,
        mode: 'insensitive',
      },
    },
    include: {
      project: {
        include: {
          columns: { orderBy: { order: 'asc' } },
        },
      },
      assignee: true,
      parent: {
        select: { id: true, key: true, title: true, type: true },
      },
      children: {
        orderBy: { createdAt: 'asc' },
        include: { assignee: true },
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

  if (!issue) {
    notFound()
  }

  return (
    <IssueDetailView
      issue={issue as any}
      columns={issue.project.columns.map((c) => ({ id: c.id, name: c.name }))}
    />
  )
}