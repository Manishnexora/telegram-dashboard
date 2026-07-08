import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isLive } from '../lib/dealStatus'
import { nextDueDate } from '../lib/paymentTerms'
import type { Approval, Channel, Payment } from '../types'

interface ChannelRow extends Channel {
  approvals: Approval[]
  owner: { name: string } | null
}

function daysUntil(date: Date) {
  const ms = date.getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function Billing() {
  const { profile } = useAuth()
  const [channels, setChannels] = useState<ChannelRow[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [recordingFor, setRecordingFor] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState('')
  const [note, setNote] = useState('')
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming')

  async function load() {
    setLoading(true)
    setError(null)

    const { data: channelData, error: channelErr } = await supabase
      .from('channels')
      .select('*, approvals(*), owner:profiles!managed_by(name)')
      .order('created_at', { ascending: false })

    if (channelErr) {
      setError(channelErr.message)
      setLoading(false)
      return
    }
    setChannels((channelData as unknown as ChannelRow[]) ?? [])

    const { data: paymentData, error: paymentErr } = await supabase
      .from('payments')
      .select('*, recorder:profiles!recorded_by(name)')
      .order('paid_at', { ascending: false })

    if (paymentErr) {
      setError(paymentErr.message)
      setLoading(false)
      return
    }
    setPayments((paymentData as unknown as Payment[]) ?? [])

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const liveDeals = channels.filter((c) => c.approvals?.[0] && isLive(c.approvals[0]))

  const upcoming = liveDeals
    .map((c) => {
      const approval = c.approvals[0]
      const paymentsForDeal = payments.filter((p) => p.approval_id === approval.id)
      const due = nextDueDate(approval, paymentsForDeal)
      return { channel: c, approval, due }
    })
    .filter((row) => row.due)
    .sort((a, b) => a.due!.getTime() - b.due!.getTime())

  const channelByApprovalId = new Map<string, ChannelRow>()
  channels.forEach((c) => c.approvals?.forEach((a) => channelByApprovalId.set(a.id, c)))

  function startRecording(approvalId: string, defaultAmount: number | null) {
    setRecordingFor(approvalId)
    setAmount(defaultAmount ? String(defaultAmount) : '')
    setPaidAt(new Date().toISOString().slice(0, 10))
    setNote('')
  }

  async function savePayment() {
    if (!recordingFor || !profile || !amount || !paidAt) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('payments').insert({
      approval_id: recordingFor,
      amount: Number(amount),
      paid_at: paidAt,
      recorded_by: profile.id,
      note: note || null,
    })
    setBusy(false)
    if (error) setError('Could not record payment: ' + error.message)
    else {
      setRecordingFor(null)
      load()
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <span className="text-2xl">💳</span>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Payment Details</h2>
          <p className="text-sm text-gray-500">Upcoming payment reminders and billing history.</p>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 text-sm px-4 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
            activeTab === 'upcoming'
              ? 'bg-rose-50 text-rose-800 border-b-2 border-rose-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Upcoming Payments
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
            activeTab === 'history'
              ? 'bg-teal-50 text-teal-800 border-b-2 border-teal-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Billing History
        </button>
      </div>

      <section className={`space-y-3 ${activeTab !== 'upcoming' ? 'hidden' : ''}`}>
        <div className="bg-white rounded-lg shadow overflow-x-auto border-l-4 border-rose-400">
          <table className="w-full text-sm">
            <thead className="bg-rose-50 text-left text-rose-800">
              <tr>
                <th className="px-4 py-2">Channel</th>
                <th className="px-4 py-2">Managed by</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Next due</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-4 text-gray-400">Loading…</td></tr>
              )}
              {!loading && upcoming.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-4 text-gray-400">No upcoming payments — set payment terms on a live deal to see reminders here.</td></tr>
              )}
              {upcoming.map(({ channel, approval, due }) => {
                const days = daysUntil(due!)
                const statusLabel = days < 0 ? `${Math.abs(days)}d overdue` : days <= 7 ? `Due in ${days}d` : `In ${days}d`
                const statusColor = days < 0 ? 'bg-red-100 text-red-700' : days <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                return (
                  <Fragment key={channel.id}>
                    <tr className="border-t border-gray-100">
                      <td className="px-4 py-2">
                        <Link to={`/channels/${channel.id}`} className="font-medium text-telegram-600 hover:underline">
                          {channel.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{channel.owner?.name ?? '—'}</td>
                      <td className="px-4 py-2">
                        {approval.negotiated_price ? `₹${approval.negotiated_price.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-2">{due!.toLocaleDateString()}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                      </td>
                      <td className="px-4 py-2">
                        {recordingFor !== approval.id ? (
                          <button
                            onClick={() => startRecording(approval.id, approval.negotiated_price)}
                            className="text-telegram-600 hover:underline"
                          >
                            Record payment
                          </button>
                        ) : (
                          <button onClick={() => setRecordingFor(null)} className="text-gray-500 hover:underline">
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                    {recordingFor === approval.id && (
                      <tr className="border-t border-gray-100 bg-gray-50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-gray-700">Amount (₹)</label>
                              <input
                                type="number"
                                autoComplete="off"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="rounded border border-gray-300 px-3 py-2 text-sm w-32"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-gray-700">Paid on</label>
                              <input
                                type="date"
                                value={paidAt}
                                onChange={(e) => setPaidAt(e.target.value)}
                                className="rounded border border-gray-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="space-y-1 flex-1 min-w-[160px]">
                              <label className="block text-xs font-medium text-gray-700">Note (optional)</label>
                              <input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <button
                              disabled={busy || !amount || !paidAt}
                              onClick={savePayment}
                              className="rounded bg-rose-600 text-white px-4 py-2 text-sm font-medium hover:bg-rose-700 disabled:opacity-40"
                            >
                              Save payment
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
      </section>

      <section className={`space-y-3 ${activeTab !== 'history' ? 'hidden' : ''}`}>
        <div className="bg-white rounded-lg shadow overflow-x-auto border-l-4 border-teal-400">
          <table className="w-full text-sm">
            <thead className="bg-teal-50 text-left text-teal-800">
              <tr>
                <th className="px-4 py-2">Channel</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Paid on</th>
                <th className="px-4 py-2">Recorded by</th>
                <th className="px-4 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {!loading && payments.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-4 text-gray-400">No payments recorded yet.</td></tr>
              )}
              {payments.map((p) => {
                const channel = channelByApprovalId.get(p.approval_id)
                return (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-4 py-2">
                      {channel ? (
                        <Link to={`/channels/${channel.id}`} className="text-telegram-600 hover:underline">
                          {channel.name}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2">₹{p.amount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2">{new Date(p.paid_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2">{p.recorder?.name ?? '—'}</td>
                    <td className="px-4 py-2">{p.note ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
