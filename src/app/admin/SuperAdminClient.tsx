'use client'

import { useState } from 'react'
import { createOrganizationAction, provisionOrgAdminAction, logoutAction } from '@/app/auth-actions'
import { useRouter } from 'next/navigation'
import { Shield, Building2, UserCheck, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react'

export default function SuperAdminClient({
  organizations = [],
  currentUsername,
}: {
  organizations: any[]
  allUsers?: any[]
  currentUsername: string
}) {
  const router = useRouter()

  // Organization form state
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [isCreatingOrg, setIsCreatingOrg] = useState(false)

  // Admin provision form state
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState(organizations[0]?.id || '')
  const [isProvisioning, setIsProvisioning] = useState(false)

  // Feedback states
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setIsCreatingOrg(true)

    try {
      const res = await createOrganizationAction(orgName, orgSlug)
      if (res.success) {
        setOrgName('')
        setOrgSlug('')
        setMessage('Organization created successfully!')
        setTimeout(() => setMessage(''), 4000)
        router.refresh()
      } else {
        setError(res.error || 'Failed to create organization')
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setIsCreatingOrg(false)
    }
  }

  const handleProvisionOrgAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    const targetOrgId = selectedOrgId || organizations[0]?.id

    if (!targetOrgId) {
      setError('Please create and select an organization first.')
      return
    }

    setIsProvisioning(true)

    try {
      const res = await provisionOrgAdminAction({
        username: username.trim(),
        email: email.trim(),
        name: name.trim(),
        password: password.trim(),
        organizationId: targetOrgId,
      })

      if (res.success) {
        setUsername('')
        setEmail('')
        setName('')
        setPassword('')
        setMessage('Organization Admin (SM / PM) provisioned successfully!')
        setTimeout(() => setMessage(''), 4000)
        router.refresh()
      } else {
        setError(res.error || 'Failed to provision admin')
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setIsProvisioning(false)
    }
  }

  const handleLogout = async () => {
    await logoutAction()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-10 text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Super Admin Console</h1>
              <p className="text-xs text-slate-500">Root session: @{currentUsername}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </header>

        {/* Global Notifications */}
        {message && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {message}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1: Create Organization */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" /> 1. Register Organization
            </h2>
            <form onSubmit={handleCreateOrg} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value)
                    if (!orgSlug) {
                      setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'))
                    }
                  }}
                  placeholder="e.g. Seth Square International"
                  className="w-full p-2.5 border rounded-lg border-slate-300 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Slug Identifier</label>
                <input
                  type="text"
                  required
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  placeholder="e.g. seth-square"
                  className="w-full p-2.5 border rounded-lg border-slate-300 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={isCreatingOrg}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer transition shadow-xs"
              >
                {isCreatingOrg ? 'Creating Organization...' : 'Create Organization'}
              </button>
            </form>
          </div>

          {/* Step 2: Appoint Org Admin (SM / PM) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" /> 2. Appoint Organization Admin (SM / PM)
            </h2>
            <form onSubmit={handleProvisionOrgAdmin} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Assign to Organization</label>
                <select
                  value={selectedOrgId || (organizations[0]?.id ?? '')}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full p-2.5 border rounded-lg border-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer bg-white"
                  required
                >
                  {organizations.length === 0 && (
                    <option value="">Create an organization first</option>
                  )}
                  {organizations.map((org: any) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. jdoe_admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-2.5 border rounded-lg border-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@team.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 border rounded-lg border-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 border rounded-lg border-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Temporary Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2.5 border rounded-lg border-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProvisioning || organizations.length === 0}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer transition shadow-xs"
              >
                {isProvisioning ? 'Provisioning Admin...' : 'Appoint Admin (SM / PM)'}
              </button>
            </form>
          </div>
        </div>

        {/* Organizations & Admin Summary Table */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Organizations & Appointed Admins</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3">Organization</th>
                  <th className="p-3">Slug</th>
                  <th className="p-3">Total Boards</th>
                  <th className="p-3">Appointed Admins (SM / PM)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {organizations.map((org: any) => {
                  const admins = org.members?.filter((m: any) => m.role === 'ORG_ADMIN') || []
                  return (
                    <tr key={org.id}>
                      <td className="p-3 font-bold text-slate-900">{org.name}</td>
                      <td className="p-3 font-mono text-slate-500">{org.slug}</td>
                      <td className="p-3 font-semibold text-blue-600">{org.projects?.length || 0} Boards</td>
                      <td className="p-3">
                        {admins.length > 0 ? (
                          admins.map((a: any) => (
                            <span
                              key={a.id}
                              className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-0.5 rounded-md text-[11px] font-semibold mr-1.5"
                            >
                              {a.user?.name || a.user?.username} (@{a.user?.username})
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">No Admin Appointed</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {organizations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                      No organizations created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}