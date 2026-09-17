'use client'

import { useState } from 'react'
import { createOrganizationAction, createUserWithRoleAction, logoutAction } from '@/app/auth-actions'
import { useRouter } from 'next/navigation'
import { Shield, Building2, UserPlus, LogOut } from 'lucide-react'

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
  const [systemRole, setSystemRole] = useState<'USER' | 'SUPER_ADMIN'>('USER')
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [selectedOrgRole, setSelectedOrgRole] = useState<'ORG_ADMIN' | 'PO' | 'SM' | 'DEV' | 'QA'>('DEV')
  const [message, setMessage] = useState('')

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await createOrganizationAction(orgName, orgSlug)
    if (res.success) {
      setOrgName('')
      setOrgSlug('')
      router.refresh()
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await createUserWithRoleAction({
      username,
      email,
      name,
      password,
      systemRole,
      organizationId: selectedOrgId || undefined,
      orgRole: selectedOrgRole,
    })
    if (res.success) {
      setUsername('')
      setEmail('')
      setName('')
      setPassword('')
      setMessage('User provisioned successfully!')
      setTimeout(() => setMessage(''), 3000)
      router.refresh()
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
        <header className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Super Admin Console</h1>
              <p className="text-xs text-slate-500">Logged in as {currentUsername}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" /> Create Organization
            </h2>
            <form onSubmit={handleCreateOrg} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Corporation"
                  className="w-full p-2 border rounded border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Slug / Identifier</label>
                <input
                  type="text"
                  required
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  placeholder="acme"
                  className="w-full p-2 border rounded border-slate-300"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded cursor-pointer"
              >
                Create Organization
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" /> Provision User & Role
            </h2>
            {message && <div className="text-emerald-600 text-xs font-bold">{message}</div>}
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500">Organization</label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="w-full p-2 border rounded border-slate-300 cursor-pointer"
                  >
                    <option value="">No Organization</option>
                    {organizations.map((org: any) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500">Role Access</label>
                  <select
                    value={selectedOrgRole}
                    onChange={(e) => setSelectedOrgRole(e.target.value as any)}
                    className="w-full p-2 border rounded border-slate-300 cursor-pointer"
                  >
                    <option value="ORG_ADMIN">Admin (Org/Project Lead)</option>
                    <option value="PO">Product Owner (PO)</option>
                    <option value="SM">Scrum Master (SM)</option>
                    <option value="DEV">Developer (Dev)</option>
                    <option value="QA">Quality Assurance (QA)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500">System Level Role</label>
                <select
                  value={systemRole}
                  onChange={(e) => setSystemRole(e.target.value as any)}
                  className="w-full p-2 border rounded border-slate-300 cursor-pointer"
                >
                  <option value="USER">Standard User</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded cursor-pointer"
              >
                Provision User
              </button>
            </form>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Provisioned Users Directory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">Username</th>
                  <th className="p-2">System Role</th>
                  <th className="p-2">Organization</th>
                  <th className="p-2">Role Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allUsers.map((u: any) => (
                  <tr key={u.id}>
                    <td className="p-2 font-medium text-slate-800">{u.name}</td>
                    <td className="p-2 font-mono text-slate-600">{u.username}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.systemRole === 'SUPER_ADMIN'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {u.systemRole}
                      </span>
                    </td>
                    <td className="p-2">{u.orgMemberships[0]?.organization?.name || '—'}</td>
                    <td className="p-2 font-semibold text-blue-600">
                      {u.orgMemberships[0]?.role || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}