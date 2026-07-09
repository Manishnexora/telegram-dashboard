import { Fragment, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { supervisorEligible } from '../lib/approvalEligibility'
import { ListFilters } from '../components/ListFilters'
import { matchesSearch, withinDateRange } from '../lib/listFilters'
import type { Approval, Channel } from '../types'

interface ChannelRow extends Channel {
  approvals: Approval[]
  owner: { name: string } | null
}

export function NewDeals() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [channels, setChannels] = useState<ChannelRow[]>([])
  const [supervisorLimit, setSupervisorLimit] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  async function load() {
    setLoading(true)
    setError(null)

    const [channelsResult, limitResult] = await Promise.all([
      supabase
        .from('channels')
        .select('*, approvals(*), owner:profiles!managed_by(name)')
        .order('created_at', { ascending: true }),
      profile?.role === 'supervisor'
        ? supabase.from('supervisor_limits').select('approval_limit').eq('user_id', profile.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (channelsResult.error) {
      setError(channelsResult.error.message)
      setLoading(false)
      return
    }
    setChannels((channelsResult.data as unknown as ChannelRow[]) ?? [])
    setSupervisorLimit(limitResult.data?.approval_limit ?? null)

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const isAdmin = profile?.role === 'admin'
  const isSupervisor = profile?.role === 'supervisor'
  const canAddChannel = profile?.role === 'teammate' || profile?.role === 'admin'

  const queueItems = channels
    .filter((c) => {
      const approval = c.approvals?.[0]
      if (!approval || !['draft', 'price_check', 'pending'].includes(approval.status)) return false
      const isMine = approval.submitted_by === profile?.id
      return isMine || isAdmin || supervisorEligible(approval, supervisorLimit)
    })
    .filter(
      (c) =>
        matchesSearch([c.name, c.handle, c.owner?.name], search) &&
        withinDateRange(c.approvals[0].updated_at, dateFrom, dateTo),
    )
    .sort((a, b) => {
      const aTime = new Date(a.approvals[0].updated_at).getTime()
      const bTime = new Date(b.approvals[0].updated_at).getTime()
      return aTime - bTime
    })
  const filtersActive = Boolean(search || dateFrom || dateTo)

  function canDecide(approval: Approval) {
    return isAdmin || (isSupervisor && supervisorEligible(approval, supervisorLimit))
  }

  async function acceptDeal(approvalId: string) {
    if (!profile) return
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('approvals')
      .update({ status: 'approved', decided_by: profile.id, decided_at: new Date().toISOString(), decision_note: null })
      .eq('id', approvalId)
    setBusy(false)
    if (error) setError('Could not accept: ' + error.message)
    else load()
  }

  async function rejectDeal(approvalId: string) {
    if (!profile) return
    if (!rejectNote.trim()) {
      setError('Please add a note explaining the rejection.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('approvals')
      .update({
        status: 'rejected',
        decided_by: profile.id,
        decided_at: new Date().toISOString(),
        decision_note: rejectNote.trim(),
      })
      .eq('id', approvalId)
    setBusy(false)
    if (error) setError('Could not reject: ' + error.message)
    else {
      setRejectingId(null)
      setRejectNote('')
      load()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🆕</span>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">New Deals</h2>
            <p className="text-sm text-gray-500">
              New and in-progress channels — still being worked on, or awaiting a price check or decision.
            </p>
          </div>
        </div>
        {canAddChannel && (
          <Link
            to="/channels/new"
            className="rounded bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-700"
          >
            + Add Channel
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 text-sm px-4 py-2">
          {error}
        </div>
      )}

      <ListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by channel name, handle, or submitter…"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        dateLabel="Waiting since"
      />

      <div className="bg-white rounded-lg shadow overflow-x-auto border-l-4 border-amber-400">
        <table className="w-full text-sm">
          <thead className="bg-amber-50 text-left text-amber-800">
            <tr>
              <th className="px-4 py-2">Channel</th>
              <th className="px-4 py-2">Submitted by</th>
              <th className="px-4 py-2">Subscribers</th>
              <th className="px-4 py-2">Asking price</th>
              <th className="px-4 py-2">Negotiated price</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-4 text-gray-400">Loading…</td></tr>
            )}
            {!loading && queueItems.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-4 text-gray-400">
                {filtersActive ? 'No results match your search/filters.' : 'Nothing is waiting on you right now.'}
              </td></tr>
            )}
            {queueItems.map((c) => {
              const approval = c.approvals[0]
              const eligible = canDecide(approval)
              const isRejectingThis = rejectingId === approval.id
              return (
                <Fragment key={c.id}>
                  <tr
                    onClick={() => navigate(`/channels/${c.id}`)}
                    className="border-t border-gray-100 cursor-pointer hover:bg-amber-50/50"
                  >
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-800">{c.name}</div>
                      {c.handle && <div className="text-xs text-gray-400">{c.handle}</div>}
                    </td>
                    <td className="px-4 py-2">{c.owner?.name ?? '—'}</td>
                    <td className="px-4 py-2">{c.subscribers?.toLocaleString('en-IN') ?? '—'}</td>
                    <td className="px-4 py-2">
                      {approval.asking_price ? `₹${approval.asking_price.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {approval.negotiated_price ? `₹${approval.negotiated_price.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700">Pending</span>
                    </td>
                    <td className="px-4 py-2">
                      {eligible ? (
                        <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            disabled={busy}
                            onClick={() => acceptDeal(approval.id)}
                            className="text-green-600 hover:underline disabled:opacity-40"
                          >
                            Accept
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => { setRejectingId(approval.id); setRejectNote('') }}
                            className="text-red-600 hover:underline disabled:opacity-40"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                  {isRejectingThis && (
                    <tr className="border-t border-gray-100 bg-gray-50" onClick={(e) => e.stopPropagation()}>
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <textarea
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Reason for rejection…"
                            rows={1}
                            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                          />
                          <button
                            disabled={busy}
                            onClick={() => rejectDeal(approval.id)}
                            className="rounded bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-40"
                          >
                            Confirm reject
                          </button>
                          <button onClick={() => setRejectingId(null)} className="text-sm text-gray-500 hover:underline">
                            Cancel
                          </button>
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
