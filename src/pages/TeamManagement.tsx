import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { ListFilters } from '../components/ListFilters'
import { matchesSearch } from '../lib/listFilters'
import type { Role } from '../types'

interface TeamMember {
  id: string
  name: string
  email: string
  role: Role
  approval_limit: number | null
  currency: string | null
  active: boolean
  created_at: string
}

const ROLES: Role[] = ['teammate', 'supervisor', 'admin']

export function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<Role>('teammate')
  const [newLimit, setNewLimit] = useState('20000')
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<Role>('teammate')
  const [editLimit, setEditLimit] = useState('')
  const [resetPassword, setResetPassword] = useState('')

  async function callFunction(payload: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('admin-users', { body: payload })
    if (error) throw new Error(error.message)
    if (data?.error) throw new Error(data.error)
    return data?.data
  }

  async function loadMembers() {
    setLoading(true)
    setError(null)
    try {
      const data = await callFunction({ action: 'list' })
      setMembers(data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await callFunction({
        action: 'create',
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
        approval_limit: newRole === 'supervisor' ? Number(newLimit) : undefined,
      })
      setNewName('')
      setNewEmail('')
      setNewPassword('')
      setNewRole('teammate')
      setNewLimit('20000')
      setShowAddForm(false)
      await loadMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(member: TeamMember) {
    setEditingId(member.id)
    setEditName(member.name)
    setEditRole(member.role)
    setEditLimit(member.approval_limit ? String(member.approval_limit) : '20000')
    setResetPassword('')
    setError(null)
  }

  async function handleSaveEdit(userId: string) {
    setError(null)
    try {
      await callFunction({
        action: 'update',
        user_id: userId,
        name: editName.trim() || undefined,
        role: editRole,
        approval_limit: editRole === 'supervisor' ? Number(editLimit) : undefined,
      })
      await loadMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleToggleActive(member: TeamMember) {
    setError(null)
    try {
      await callFunction({ action: 'set_active', user_id: member.id, active: !member.active })
      await loadMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleResetPassword(userId: string) {
    if (resetPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setError(null)
    try {
      await callFunction({ action: 'set_password', user_id: userId, password: resetPassword })
      setResetPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDelete(member: TeamMember) {
    if (!confirm(`Permanently remove ${member.name || member.email}? This cannot be undone.`)) return
    setError(null)
    try {
      await callFunction({ action: 'delete', user_id: member.id })
      setEditingId(null)
      await loadMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const filteredMembers = members.filter((m) => matchesSearch([m.name, m.email], search))
  const filtersActive = Boolean(search)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👥</span>
          <h2 className="text-lg font-semibold text-gray-800">Team Management</h2>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700"
        >
          {showAddForm ? 'Cancel' : '+ Add team member'}
        </button>
      </div>

      {error && (
          <div className="rounded border border-red-300 bg-red-50 text-red-700 text-sm px-4 py-2">
            {error}
          </div>
        )}

        {showAddForm && (
          <form onSubmit={handleAdd} className="bg-white rounded-lg shadow p-6 space-y-4 max-w-lg border-l-4 border-indigo-400">
            <h2 className="font-medium text-gray-800">Add a team member</h2>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Temporary password</label>
              <input
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400">Share this with them directly — they can log in with it right away.</p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {newRole === 'supervisor' && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Approval limit (INR)</label>
                <input
                  type="number"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create team member'}
            </button>
          </form>
        )}

        <ListFilters search={search} onSearchChange={setSearch} searchPlaceholder="Search by name or email…" />

        <div className="bg-white rounded-lg shadow overflow-x-auto border-l-4 border-indigo-400">
          <table className="w-full text-sm">
            <thead className="bg-indigo-50 text-left text-indigo-800">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Approval limit</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-4 text-gray-400">Loading…</td></tr>
              )}
              {!loading && filteredMembers.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-4 text-gray-400">
                  {filtersActive ? 'No results match your search.' : 'No team members yet.'}
                </td></tr>
              )}
              {filteredMembers.map((m) => {
                const isOpen = editingId === m.id
                return (
                  <Fragment key={m.id}>
                    <tr className="border-t border-gray-100">
                      <td className="px-4 py-2">{m.name}</td>
                      <td className="px-4 py-2">{m.email}</td>
                      <td className="px-4 py-2">{m.role}</td>
                      <td className="px-4 py-2">
                        {m.approval_limit ? `₹${m.approval_limit.toLocaleString('en-IN')}` : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span className={m.active ? 'text-green-600' : 'text-gray-400'}>
                          {m.active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => (isOpen ? setEditingId(null) : startEdit(m))}
                          className="text-telegram-600 hover:underline"
                        >
                          {isOpen ? 'Close' : 'Edit'}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-gray-100 bg-gray-50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="max-w-lg space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="block text-xs font-medium text-gray-700">Name</label>
                                <input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-xs font-medium text-gray-700">Role</label>
                                <select
                                  value={editRole}
                                  onChange={(e) => setEditRole(e.target.value as Role)}
                                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                >
                                  {ROLES.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {editRole === 'supervisor' && (
                              <div className="space-y-1">
                                <label className="block text-xs font-medium text-gray-700">Approval limit (INR)</label>
                                <input
                                  type="number"
                                  value={editLimit}
                                  onChange={(e) => setEditLimit(e.target.value)}
                                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                                />
                              </div>
                            )}

                            <button
                              onClick={() => handleSaveEdit(m.id)}
                              className="rounded bg-telegram-600 text-white px-4 py-2 text-sm font-medium hover:bg-telegram-700"
                            >
                              Save changes
                            </button>

                            <div className="border-t border-gray-200 pt-4 space-y-1">
                              <label className="block text-xs font-medium text-gray-700">Reset password</label>
                              <div className="flex flex-wrap items-end gap-3">
                                <input
                                  autoComplete="off"
                                  minLength={6}
                                  placeholder="New password"
                                  value={resetPassword}
                                  onChange={(e) => setResetPassword(e.target.value)}
                                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                                />
                                <button
                                  disabled={resetPassword.length < 6}
                                  onClick={() => handleResetPassword(m.id)}
                                  className="rounded bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                                >
                                  Set password
                                </button>
                              </div>
                              <p className="text-xs text-gray-400">Share the new password with them directly.</p>
                            </div>

                            {m.role !== 'admin' && (
                              <div className="border-t border-gray-200 pt-4 flex flex-wrap gap-4">
                                <button
                                  onClick={() => handleToggleActive(m)}
                                  className="text-amber-600 hover:underline text-sm"
                                >
                                  {m.active ? 'Deactivate account' : 'Reactivate account'}
                                </button>
                                <button
                                  onClick={() => handleDelete(m)}
                                  className="text-red-600 hover:underline text-sm"
                                >
                                  Remove member
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
    </div>
  )
}
