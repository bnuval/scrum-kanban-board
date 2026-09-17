'use client'

import { useState } from 'react'
import { createOrganizationAction, provisionOrgAdminAction, logoutAction } from '@/app/auth-actions'
import { useRouter } from 'next/navigation'
import { Shield, Building2, UserCheck, LogOut } from 'lucide-react'

export default function SuperAdminClient({
  organizations,
  allUsers,
  currentUsername,
}: any) {
  const router = useRouter()
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState(organizations[0]?.id || '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await createOrganizationAction(orgName, orgSlug)
    if (res.success) {
      setOrgName('')
      setOrgSlug('')
      router.refresh()
    } else {
      setError(res.error || 'Failed to create organization')
    }
  }

  const handleProvisionOrgAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!selectedOrgId) {
      setError('Please select an organization')
      return
    }

    const res = await provisionOrgAdminAction({
      username,
      email,
      name,
      password,
      organizationId: selectedOrgId,
    })

    if (res.success) {
      setUsername('')
      setEmail('')
      setName('')
      setPassword('')
      setMessage('Organization Admin (SM/PM) provisioned successfully!')
      setTimeout(() => setMessage(''), 3000)
      router.refresh()
    } else {
      setError(res.error || 'Failed to provision admin')
    }
  }

  const handleLogout = async () => {
    await logoutAction()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Root System Console</h1>
              <p className="text-xs text-slate-500">Logged in as {currentUsername} (Super Admin)</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </header>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1: Create Organization */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" /> 1. Create Organization
            </h2>
            <form onSubmit={handleCreateOrg} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Company / Org Name</label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Seth Square International"
                  className="w-full p-2 border rounded border-slate-300"
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
                  className="w-full p-2 border rounded border-slate-300"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded cursor-pointer"
              >
                Register Organization
              </button>
            </form>
          </div>

          {/* Step 2: Appoint Org Admin (SM / PM) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" /> 2. Appoint Org Admin (SM / PM)
            </h2>
            {message && <div className="text-emerald-600 text-xs font-bold">{message}</div>}
            <form onSubmit={handleProvisionOrgAdmin} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Assign to Organization</label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full p-2 border rounded border-slate-300 cursor-pointer"
                  required
                >
                  <option value="">Select Organization</option>
                  {organizations.map((org: any) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.slug})
                    </option>
                  ))}
                </select>
              </div>

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
                  placeholder="Work Email"
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
                  placeholder="Temporary Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="p-2 border rounded border-slate-300"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded cursor-pointer"
              >
                Appoint Admin (SM / PM)
              </button>
            </form>
          </div>
        </div>

        {/* Directory */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Organizations & Appointed Admins</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-2">Organization</th>
                  <th className="p-2">Slug</th>
                  <th className="p-2">Projects / Boards</th>
                  <th className="p-2">Appointed Admins (SM/PM)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {organizations.map((org: any) => {
                  const admins = org.members.filter((m: any) => m.role === 'ORG_ADMIN')
                  return (
                    <tr key={org.id}>
                      <td className="p-2 font-bold text-slate-800">{org.name}</td>
                      <td className="p-2 font-mono text-slate-500">{org.slug}</td>
                      <td className="p-2 font-semibold text-blue-600">{org.projects.length} Boards</td>
                      <td className="p-2">
                        {admins.length > 0 ? (
                          admins.map((a: any) => (
                            <span key={a.id} className="inline-block bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-semibold mr-1">
                              {a.user.name} (@{a.user.username})
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">No Admin Appointed Yet</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}