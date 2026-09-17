import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SuperAdminClient from './SuperAdminClient'

export const dynamic = 'force-dynamic'

export default async function SuperAdminPage() {
  const session = await getSession()

  if (!session || session.systemRole !== 'SUPER_ADMIN') {
    redirect('/')
  }

  const organizations = await prisma.organization.findMany({
    include: {
      members: { include: { user: true } },
      projects: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const allUsers = await prisma.user.findMany({
    include: {
      orgMemberships: { include: { organization: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <SuperAdminClient
      organizations={organizations}
      allUsers={allUsers}
      currentUsername={session.username}
    />
  )
}