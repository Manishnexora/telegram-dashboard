import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isLive } from '../lib/dealStatus'
import { ensureUrl, telegramLink } from '../lib/links'
import { ListFilters } from '../components/ListFilters'
import { matchesSearch, withinDateRange } from '../lib/listFilters'
import type { Approval, Channel } from '../types'

interface LiveApproval extends Approval {
  decider?: { name: string } | null
}

interface ChannelRow extends Channel {
  approvals: LiveApproval[]
}

function LinkCell({ url, label }: { url: string | null; label: string }) {
  if (!url) return <span className="text-gray-400">—</span>
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-telegram-600 hover:underline"
    >
      {label}
    </a>
  )
}

export function LiveDeals() {
  const navigate = useNavigate()
  const [channels, setChannels] = useState<ChannelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('channels')
      .select('*, approvals(*, decider:profiles!decided_by(name))')
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

  const liveDeals = channels
    .filter((c) => c.approvals?.[0] && isLive(c.approvals[0]))
    .filter(
      (c) =>
        matchesSearch(
          [
            c.name,
            c.handle,
            c.owner_name,
            c.social_link,
            c.subscribers?.toString(),
            c.channel_code,
            c.whatsapp_link,
            c.views?.toString(),
            c.previous_deal_company,
            c.previous_deal_amount?.toString(),
            c.criteria,
          ],
          search,
        ) && withinDateRange(c.channel_created_date, dateFrom, dateTo),
    )
  const filtersActive = Boolean(search || dateFrom || dateTo)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🟢</span>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Live Deals</h2>
          <p className="text-sm text-gray-500">Channels with an active, approved arrangement.</p>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 text-sm px-4 py-2">
          {error}
        </div>
      )}

      <ListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by channel name, handle, or owner…"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />

      <div className="bg-white rounded-lg shadow overflow-x-auto border-l-4 border-emerald-400">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-emerald-50 text-left text-emerald-800">
            <tr>
              <th className="px-2 py-2"></th>
              <th className="px-4 py-2">Channel</th>
              <th className="px-4 py-2">Channel link</th>
              <th className="px-4 py-2">Owner name</th>
              <th className="px-4 py-2">YouTube / Instagram</th>
              <th className="px-4 py-2">Subscribers</th>
              <th className="px-4 py-2">Channel code</th>
              <th className="px-4 py-2">WhatsApp link</th>
              <th className="px-4 py-2">Channel views</th>
              <th className="px-4 py-2">Channel created</th>
              <th className="px-4 py-2">Prev. deal company</th>
              <th className="px-4 py-2">Prev. deal amount</th>
              <th className="px-4 py-2">Criteria</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={13} className="px-4 py-4 text-gray-400">Loading…</td></tr>
            )}
            {!loading && liveDeals.length === 0 && (
              <tr><td colSpan={13} className="px-4 py-4 text-gray-400">
                {filtersActive ? 'No results match your search/filters.' : 'No live deals right now.'}
              </td></tr>
            )}
            {liveDeals.map((c) => {
              const approval = c.approvals[0]
              const expanded = expandedId === c.id
              return (
                <Fragment key={c.id}>
                  <tr
                    onClick={() => navigate(`/channels/${c.id}`)}
                    className="border-t border-gray-100 cursor-pointer hover:bg-emerald-50/50"
                  >
                    <td className="px-2 py-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedId(expanded ? null : c.id) }}
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Toggle details"
                      >
                        {expanded ? '▾' : '▸'}
                      </button>
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-2"><LinkCell url={telegramLink(c.handle)} label={c.handle ?? ''} /></td>
                    <td className="px-4 py-2">{c.owner_name ?? '—'}</td>
                    <td className="px-4 py-2"><LinkCell url={ensureUrl(c.social_link)} label="Open" /></td>
                    <td className="px-4 py-2">{c.subscribers?.toLocaleString('en-IN') ?? '—'}</td>
                    <td className="px-4 py-2">{c.channel_code ?? '—'}</td>
                    <td className="px-4 py-2"><LinkCell url={ensureUrl(c.whatsapp_link)} label="Open" /></td>
                    <td className="px-4 py-2">{c.views?.toLocaleString('en-IN') ?? '—'}</td>
                    <td className="px-4 py-2">
                      {c.channel_created_date ? new Date(c.channel_created_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2">{c.previous_deal_company ?? '—'}</td>
                    <td className="px-4 py-2">
                      {c.previous_deal_amount ? `₹${c.previous_deal_amount.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-2 max-w-[160px] truncate">{c.criteria ?? '—'}</td>
                  </tr>
                  {expanded && (
                    <tr className="border-t border-gray-100 bg-gray-50">
                      <td colSpan={13} className="px-6 py-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div><span className="text-gray-500">Channel:</span> {c.name}</div>
                          <div>
                            <span className="text-gray-500">Channel link:</span>{' '}
                            <LinkCell url={telegramLink(c.handle)} label={c.handle ?? '—'} />
                          </div>
                          <div><span className="text-gray-500">Owner name:</span> {c.owner_name ?? '—'}</div>
                          <div>
                            <span className="text-gray-500">YouTube / Instagram:</span>{' '}
                            <LinkCell url={ensureUrl(c.social_link)} label={c.social_link ?? '—'} />
                          </div>
                          <div><span className="text-gray-500">Subscribers:</span> {c.subscribers?.toLocaleString('en-IN') ?? '—'}</div>
                          <div><span className="text-gray-500">Channel code:</span> {c.channel_code ?? '—'}</div>
                          <div>
                            <span className="text-gray-500">WhatsApp link:</span>{' '}
                            <LinkCell url={ensureUrl(c.whatsapp_link)} label={c.whatsapp_link ?? '—'} />
                          </div>
                          <div><span className="text-gray-500">Channel views:</span> {c.views?.toLocaleString('en-IN') ?? '—'}</div>
                          <div>
                            <span className="text-gray-500">Channel created:</span>{' '}
                            {c.channel_created_date ? new Date(c.channel_created_date).toLocaleDateString() : '—'}
                          </div>
                          <div><span className="text-gray-500">Prev. deal company:</span> {c.previous_deal_company ?? '—'}</div>
                          <div>
                            <span className="text-gray-500">Prev. deal amount:</span>{' '}
                            {c.previous_deal_amount ? `₹${c.previous_deal_amount.toLocaleString('en-IN')}` : '—'}
                          </div>
                          <div><span className="text-gray-500">Negotiated price:</span> {approval.negotiated_price ? `₹${approval.negotiated_price.toLocaleString('en-IN')}` : '—'}</div>
                          <div><span className="text-gray-500">Approved by:</span> {approval.decider?.name ?? '—'}</div>
                          <div className="col-span-3">
                            <span className="text-gray-500">Criteria:</span> {c.criteria ?? '—'}
                          </div>
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
