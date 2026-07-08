import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isHistorical } from '../lib/dealStatus'
import { StatusBadge } from '../components/StatusBadge'
import type { Approval, Channel } from '../types'

interface HistoryApproval extends Approval {
  decider?: { name: string } | null
  ender?: { name: string } | null
}

interface ChannelRow extends Channel {
  approvals: HistoryApproval[]
  owner: { name: string } | null
}

function historyTime(a: Approval) {
  return new Date(a.ended_at ?? a.decided_at ?? a.updated_at).getTime()
}

export function History() {
  const navigate = useNavigate()
  const [channels, setChannels] = useState<ChannelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('channels')
      .select('*, approvals(*, decider:profiles!decided_by(name), ender:profiles!ended_by(name)), owner:profiles!managed_by(name)')
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

  const historyItems = channels
    .filter((c) => c.approvals?.[0] && isHistorical(c.approvals[0]))
    .sort((a, b) => historyTime(b.approvals[0]) - historyTime(a.approvals[0]))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🕘</span>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">History</h2>
          <p className="text-sm text-gray-500">Rejected channels and deals that were ended.</p>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 text-sm px-4 py-2">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto border-l-4 border-violet-400">
        <table className="w-full text-sm">
          <thead className="bg-violet-50 text-left text-violet-800">
            <tr>
              <th className="px-4 py-2">Channel</th>
              <th className="px-4 py-2">Managed by</th>
              <th className="px-4 py-2">Subscribers</th>
              <th className="px-4 py-2">Negotiated price</th>
              <th className="px-4 py-2">Outcome</th>
              <th className="px-4 py-2">Decided by</th>
              <th className="px-4 py-2">Note</th>
              <th className="px-4 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-4 py-4 text-gray-400">Loading…</td></tr>
            )}
            {!loading && historyItems.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-4 text-gray-400">Nothing in history yet.</td></tr>
            )}
            {historyItems.map((c) => {
              const approval = c.approvals[0]
              return (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/channels/${c.id}`)}
                  className="border-t border-gray-100 cursor-pointer hover:bg-violet-50/50"
                >
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-800">{c.name}</div>
                    {c.handle && <div className="text-xs text-gray-400">{c.handle}</div>}
                  </td>
                  <td className="px-4 py-2">{c.owner?.name ?? '—'}</td>
                  <td className="px-4 py-2">{c.subscribers?.toLocaleString('en-IN') ?? '—'}</td>
                  <td className="px-4 py-2">
                    {approval.negotiated_price ? `₹${approval.negotiated_price.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-2 flex items-center gap-2">
                    <StatusBadge status={approval.status} />
                    {approval.ended_at && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-600">Ended</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{(approval.ended_at ? approval.ender?.name : approval.decider?.name) ?? '—'}</td>
                  <td className="px-4 py-2">{approval.decision_note ?? approval.end_note ?? '—'}</td>
                  <td className="px-4 py-2">{new Date(historyTime(approval)).toLocaleDateString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
