import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { StatusBadge } from '../components/StatusBadge'
import type { Approval, Channel } from '../types'

interface ChannelRow extends Channel {
  approvals: Approval[]
  owner: { name: string } | null
}

export function Channels() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [channels, setChannels] = useState<ChannelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('channels')
      .select('*, approvals(*), owner:profiles!managed_by(name)')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setChannels((data as unknown as ChannelRow[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const showOwnerColumn = profile?.role !== 'teammate'
  const isTeammate = profile?.role === 'teammate'
  const rejected = channels.filter((c) => c.approvals?.[0]?.status === 'rejected')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">📁</span>
        <h2 className="text-lg font-semibold text-gray-800">All Channels</h2>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 text-sm px-4 py-2">
          {error}
        </div>
      )}

      {isTeammate && rejected.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 text-sm px-4 py-3 space-y-1">
          <p className="font-medium">
            {rejected.length} channel{rejected.length > 1 ? 's were' : ' was'} rejected — needs your attention:
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {rejected.map((c) => (
              <li key={c.id}>
                <Link to={`/channels/${c.id}`} className="underline font-medium">{c.name}</Link>
                {c.approvals[0].decision_note && <span> — {c.approvals[0].decision_note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto border-l-4 border-sky-400">
        <table className="w-full text-sm">
          <thead className="bg-sky-50 text-left text-sky-800">
            <tr>
              <th className="px-4 py-2">Channel</th>
              {showOwnerColumn && <th className="px-4 py-2">Managed by</th>}
              <th className="px-4 py-2">Subscribers</th>
              <th className="px-4 py-2">Asking price</th>
              <th className="px-4 py-2">Negotiated price</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-4 text-gray-400">Loading…</td></tr>
            )}
            {!loading && channels.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-4 text-gray-400">No channels yet.</td></tr>
            )}
            {channels.map((c) => {
              const approval = c.approvals?.[0]
              return (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/channels/${c.id}`)}
                  className={`border-t border-gray-100 cursor-pointer hover:bg-sky-50/50 ${approval?.status === 'rejected' ? 'bg-red-50' : ''}`}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-800">{c.name}</div>
                    {c.handle && <div className="text-xs text-gray-400">{c.handle}</div>}
                  </td>
                  {showOwnerColumn && <td className="px-4 py-2">{c.owner?.name ?? '—'}</td>}
                  <td className="px-4 py-2">{c.subscribers?.toLocaleString('en-IN') ?? '—'}</td>
                  <td className="px-4 py-2">
                    {approval?.asking_price ? `₹${approval.asking_price.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-2">
                    {approval?.negotiated_price ? `₹${approval.negotiated_price.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={approval?.status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

