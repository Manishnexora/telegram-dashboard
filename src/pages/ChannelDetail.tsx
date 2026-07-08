import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadProofFile, getProofSignedUrl } from '../lib/proofs'
import { supervisorEligible } from '../lib/approvalEligibility'
import { estimatedEndDate, formatPaymentTerms } from '../lib/paymentTerms'
import { fetchTelegramStats } from '../lib/telegramStats'
import { useAuth } from '../context/AuthContext'
import { StatusBadge } from '../components/StatusBadge'
import {
  PAYMENT_PERIOD_LABELS,
  PAYMENT_PERIOD_UNITS,
  PROOF_STAGES,
  type Approval,
  type Channel,
  type NegotiationProof,
  type PaymentPeriodUnit,
  type PriceGuidance,
  type ProofStage,
} from '../types'

interface ApprovalWithNames extends Approval {
  decider?: { name: string } | null
  ender?: { name: string } | null
}

export function ChannelDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()

  const [channel, setChannel] = useState<Channel | null>(null)
  const [approval, setApproval] = useState<ApprovalWithNames | null>(null)
  const [proofs, setProofs] = useState<NegotiationProof[]>([])
  const [guidanceLog, setGuidanceLog] = useState<PriceGuidance[]>([])
  const [supervisorLimit, setSupervisorLimit] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [statsNotes, setStatsNotes] = useState<string[]>([])

  const [askingPrice, setAskingPrice] = useState('')
  const [negotiatedPrice, setNegotiatedPrice] = useState('')
  const [targetPriceInput, setTargetPriceInput] = useState('')
  const [bidPriceInput, setBidPriceInput] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [endReason, setEndReason] = useState('')
  const [showEndDealBox, setShowEndDealBox] = useState(false)
  const [paymentPeriodUnit, setPaymentPeriodUnit] = useState<PaymentPeriodUnit | ''>('')
  const [paymentPeriodCount, setPaymentPeriodCount] = useState('')

  const [proofStage, setProofStage] = useState<ProofStage>('first_contact')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofCaption, setProofCaption] = useState('')

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)

    const { data: channelData, error: channelErr } = await supabase
      .from('channels')
      .select('*')
      .eq('id', id)
      .single()

    if (channelErr || !channelData) {
      setError(channelErr?.message ?? 'Channel not found')
      setLoading(false)
      return
    }
    setChannel(channelData)

    const { data: approvalData, error: approvalErr } = await supabase
      .from('approvals')
      .select('*, decider:profiles!decided_by(name), ender:profiles!ended_by(name)')
      .eq('channel_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (approvalErr) {
      setError(approvalErr.message)
      setLoading(false)
      return
    }

    if (approvalData) {
      setApproval(approvalData)
      setAskingPrice(approvalData.asking_price ? String(approvalData.asking_price) : '')
      setNegotiatedPrice(approvalData.negotiated_price ? String(approvalData.negotiated_price) : '')
      setTargetPriceInput(approvalData.target_price ? String(approvalData.target_price) : '')
      setBidPriceInput(approvalData.bid_price ? String(approvalData.bid_price) : '')
      setPaymentPeriodUnit(approvalData.payment_period_unit ?? '')
      setPaymentPeriodCount(approvalData.payment_period_count ? String(approvalData.payment_period_count) : '')

      const { data: proofData } = await supabase
        .from('negotiation_proofs')
        .select('*')
        .eq('approval_id', approvalData.id)
        .order('uploaded_at', { ascending: true })
      setProofs(proofData ?? [])

      const { data: guidanceData } = await supabase
        .from('price_guidance_log')
        .select('*, setter:profiles!set_by(name)')
        .eq('approval_id', approvalData.id)
        .order('created_at', { ascending: false })
      setGuidanceLog((guidanceData as unknown as PriceGuidance[]) ?? [])
    }

    if (profile?.role === 'supervisor') {
      const { data: limitData } = await supabase
        .from('supervisor_limits')
        .select('approval_limit')
        .eq('user_id', profile.id)
        .maybeSingle()
      setSupervisorLimit(limitData?.approval_limit ?? null)
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.id])

  if (loading) return <p className="text-gray-500">Loading…</p>
  if (error) return <p className="text-red-600 text-sm">{error}</p>
  if (!channel || !approval) return <p className="text-gray-500">Not found.</p>

  const isOwner = profile?.id === approval.submitted_by
  const isAdmin = profile?.role === 'admin'
  const isSupervisor = profile?.role === 'supervisor'
  const canEditChannelInfo = (isOwner || isAdmin) && approval.status !== 'approved'
  const canEditPricing = isOwner && (approval.status === 'draft' || approval.status === 'rejected')

  // A price-less channel (e.g. a no-cost collaboration) is admin-only — a supervisor
  // needs an actual asking or negotiated price to compare against their own limit.
  const isEligible = isSupervisor && supervisorEligible(approval, supervisorLimit)

  // Approve/Reject, and giving/adjusting guidance (target/bid price), is available
  // at any stage — not just after a formal "pending" submission or only during
  // 'price_check' — so collaboration channels with no negotiation can be decided
  // immediately, and a supervisor can keep adjusting guidance as talks evolve.
  const isDecided = approval.status === 'approved' || approval.status === 'rejected'
  const canGiveGuidance = !isDecided && (isAdmin || isEligible)
  const canDecide = !isDecided && (isAdmin || isEligible)

  // Payment terms are descriptive deal info, not a negotiation input — the
  // owning teammate can set them while still drafting/revising, same window as
  // pricing; admin/an eligible supervisor can also set or correct them anytime.
  const canEditPaymentTerms = (isOwner && (approval.status === 'draft' || approval.status === 'rejected')) || isAdmin || isEligible
  const canEndDeal = (isAdmin || isEligible) && approval.status === 'approved' && !approval.ended_at

  async function saveChannelInfo(fields: Partial<Channel>) {
    if (!channel) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('channels').update(fields).eq('id', channel.id)
    setBusy(false)
    if (error) setError(error.message)
    else load()
  }

  async function refreshStats() {
    if (!channel?.handle) {
      setError('This channel has no handle/link set, so stats can\'t be fetched from Telegram.')
      return
    }
    setBusy(true)
    setError(null)
    setStatsNotes([])
    try {
      const stats = await fetchTelegramStats(channel.handle)
      await saveChannelInfo({
        subscribers: stats.subscribers ?? channel.subscribers,
        views: stats.avg_views ?? channel.views,
        likes: stats.avg_reactions ?? channel.likes,
      })
      setStatsNotes(stats.notes)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function savePricing() {
    if (!approval) return
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('approvals')
      .update({
        asking_price: askingPrice ? Number(askingPrice) : null,
        negotiated_price: negotiatedPrice ? Number(negotiatedPrice) : null,
      })
      .eq('id', approval.id)
    setBusy(false)
    if (error) setError(error.message)
    else load()
  }

  async function requestPriceCheck() {
    if (!approval) return
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('approvals')
      .update({ asking_price: askingPrice ? Number(askingPrice) : null, status: 'price_check' })
      .eq('id', approval.id)
    setBusy(false)
    if (error) setError('Could not request price check: ' + error.message)
    else load()
  }

  async function sendGuidance() {
    if (!approval || !profile || (!targetPriceInput && !bidPriceInput)) return
    setBusy(true)
    setError(null)

    const resolvedTarget = targetPriceInput ? Number(targetPriceInput) : approval.target_price
    const resolvedBid = bidPriceInput ? Number(bidPriceInput) : approval.bid_price

    const { error } = await supabase
      .from('approvals')
      .update({ target_price: resolvedTarget, bid_price: resolvedBid, status: 'draft' })
      .eq('id', approval.id)

    if (error) {
      setBusy(false)
      setError('Could not send guidance: ' + error.message)
      return
    }

    const { error: logErr } = await supabase.from('price_guidance_log').insert({
      approval_id: approval.id,
      set_by: profile.id,
      target_price: resolvedTarget,
      bid_price: resolvedBid,
    })

    setBusy(false)
    if (logErr) setError('Guidance saved, but could not log history: ' + logErr.message)
    else load()
  }

  async function decide(decision: 'approved' | 'rejected') {
    if (!approval || !profile) return
    if (decision === 'rejected' && !rejectNote.trim()) {
      setError('Please add a note explaining the rejection.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('approvals')
      .update({
        status: decision,
        decided_by: profile.id,
        decided_at: new Date().toISOString(),
        decision_note: decision === 'rejected' ? rejectNote.trim() : null,
      })
      .eq('id', approval.id)
    setBusy(false)
    if (error) setError('Could not record decision: ' + error.message)
    else {
      setShowRejectBox(false)
      setRejectNote('')
      load()
    }
  }

  async function savePaymentTerms() {
    if (!approval) return
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('approvals')
      .update({
        payment_period_unit: paymentPeriodUnit || null,
        payment_period_count: paymentPeriodCount ? Number(paymentPeriodCount) : null,
      })
      .eq('id', approval.id)
    setBusy(false)
    if (error) setError('Could not save payment terms: ' + error.message)
    else load()
  }

  async function endDeal() {
    if (!approval || !profile) return
    if (!endReason.trim()) {
      setError('Please add a reason for ending this deal.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('approvals')
      .update({
        ended_at: new Date().toISOString(),
        ended_by: profile.id,
        end_note: endReason.trim(),
      })
      .eq('id', approval.id)
    setBusy(false)
    if (error) setError('Could not end deal: ' + error.message)
    else {
      setShowEndDealBox(false)
      setEndReason('')
      load()
    }
  }

  async function handleUploadProof(e: FormEvent) {
    e.preventDefault()
    if (!approval || !profile || !proofFile) return
    setBusy(true)
    setError(null)
    try {
      const path = await uploadProofFile(approval.id, proofFile)
      const { error: insertErr } = await supabase.from('negotiation_proofs').insert({
        approval_id: approval.id,
        uploaded_by: profile.id,
        stage: proofStage,
        file_type: proofFile.type.startsWith('video') ? 'screen_recording' : 'screenshot',
        file_url: path,
        caption: proofCaption || null,
      })
      if (insertErr) throw insertErr
      setProofFile(null)
      setProofCaption('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleViewProof(path: string) {
    try {
      const url = await getProofSignedUrl(path)
      window.open(url, '_blank')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const hasProof = proofs.length > 0

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/channels" className="text-sm text-telegram-600 hover:underline">← All Channels</Link>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">{channel.name}</h2>
        <div className="flex items-center gap-2">
          <StatusBadge status={approval.status} size="lg" />
          {approval.ended_at && (
            <span className="px-3 py-1 rounded text-sm font-medium bg-gray-200 text-gray-600">Ended</span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 text-sm px-4 py-2">{error}</div>
      )}

      {approval.status === 'rejected' && approval.decision_note && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 text-sm px-4 py-2">
          <strong>Rejected</strong>{approval.decider?.name ? ` by ${approval.decider.name}` : ''}: {approval.decision_note}
        </div>
      )}
      {approval.status === 'approved' && !approval.ended_at && (
        <div className="rounded border border-green-300 bg-green-50 text-green-700 text-sm px-4 py-2">
          <strong>Approved</strong>{approval.decider?.name ? ` by ${approval.decider.name}` : ''}
          {approval.decision_note ? `: ${approval.decision_note}` : '.'}
        </div>
      )}
      {approval.status === 'approved' && approval.ended_at && (
        <div className="rounded border border-gray-300 bg-gray-100 text-gray-700 text-sm px-4 py-2">
          <strong>Deal ended</strong> {new Date(approval.ended_at).toLocaleDateString()}
          {approval.ender?.name ? ` by ${approval.ender.name}` : ''}
          {approval.end_note ? `: ${approval.end_note}` : '.'}
        </div>
      )}

      {/* Channel info */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4 border-l-4 border-sky-400">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-800">Channel stats</h3>
          {canEditChannelInfo && channel.handle && (
            <button
              onClick={refreshStats}
              disabled={busy}
              className="text-sm text-telegram-600 hover:underline disabled:opacity-40"
            >
              {busy ? 'Refreshing…' : 'Refresh stats'}
            </button>
          )}
        </div>
        {statsNotes.length > 0 && (
          <ul className="text-xs text-amber-600 space-y-0.5">
            {statsNotes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <Field label="Handle" value={channel.handle} editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ handle: v || null })} />
          <Field label="Niche" value={channel.niche} editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ niche: v || null })} />
          <Field label="Audience / geo" value={channel.audience_geo} editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ audience_geo: v || null })} />
          <Field label="Channel created date" value={channel.channel_created_date} type="date" editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ channel_created_date: v || null })} />
          <Field label="Subscribers" value={channel.subscribers?.toString() ?? null} type="number" editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ subscribers: v ? Number(v) : null })} />
          <Field label="Avg. views" value={channel.views?.toString() ?? null} type="number" editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ views: v ? Number(v) : null })} />
          <Field label="Avg. likes" value={channel.likes?.toString() ?? null} type="number" editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ likes: v ? Number(v) : null })} />
          <Field label="Owner name" value={channel.owner_name} editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ owner_name: v || null })} />
          <Field label="Channel code" value={channel.channel_code} editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ channel_code: v || null })} />
          <Field label="YouTube / Instagram link" value={channel.social_link} editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ social_link: v || null })} />
          <Field label="WhatsApp link" value={channel.whatsapp_link} editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ whatsapp_link: v || null })} />
          <Field label="Previous deal company" value={channel.previous_deal_company} editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ previous_deal_company: v || null })} />
          <Field label="Previous deal amount" value={channel.previous_deal_amount?.toString() ?? null} type="number" editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ previous_deal_amount: v ? Number(v) : null })} />
          <Field label="Criteria" value={channel.criteria} editable={canEditChannelInfo}
            onSave={(v) => saveChannelInfo({ criteria: v || null })} />
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4 border-l-4 border-amber-400">
        <h3 className="font-medium text-gray-800">Pricing & negotiation</h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="space-y-1">
            <label className="block font-medium text-gray-700">Asking price (₹)</label>
            {canEditPricing ? (
              <input
                type="number"
                autoComplete="off"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                onBlur={savePricing}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            ) : (
              <p className="text-gray-800">{approval.asking_price ? `₹${approval.asking_price.toLocaleString('en-IN')}` : '—'}</p>
            )}
            <p className="text-xs text-gray-400">Owner's initial quote</p>
          </div>

          <div className="space-y-1">
            <label className="block font-medium text-gray-700">Target price (₹)</label>
            <p className="text-gray-800 py-2">{approval.target_price ? `₹${approval.target_price.toLocaleString('en-IN')}` : '—'}</p>
            <p className="text-xs text-gray-400">Max cap — don't exceed</p>
          </div>

          <div className="space-y-1">
            <label className="block font-medium text-gray-700">Bid price (₹)</label>
            <p className="text-gray-800 py-2">{approval.bid_price ? `₹${approval.bid_price.toLocaleString('en-IN')}` : '—'}</p>
            <p className="text-xs text-gray-400">Opening counter-offer</p>
          </div>

          <div className="space-y-1">
            <label className="block font-medium text-gray-700">
              {isDecided ? 'Negotiated price (₹)' : 'Negotiation price (₹)'}
            </label>
            {canEditPricing ? (
              <input
                type="number"
                autoComplete="off"
                value={negotiatedPrice}
                onChange={(e) => setNegotiatedPrice(e.target.value)}
                onBlur={savePricing}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            ) : (
              <p className="text-gray-800">{approval.negotiated_price ? `₹${approval.negotiated_price.toLocaleString('en-IN')}` : '—'}</p>
            )}
            <p className="text-xs text-gray-400">
              {isDecided ? 'Final agreed number' : "Owner's latest number — still moving"}
            </p>
          </div>
        </div>

        {/* Teammate (owner) actions */}
        {isOwner && (approval.status === 'draft' || approval.status === 'rejected') && (
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              disabled={busy || !askingPrice || !hasProof}
              onClick={requestPriceCheck}
              title={!hasProof ? 'Upload at least one proof file first' : ''}
              className="rounded bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-40"
            >
              Request price check
            </button>
          </div>
        )}
        {isOwner && approval.status === 'price_check' && (
          <p className="text-sm text-amber-700">Waiting for a target price from an admin or supervisor.</p>
        )}
        {isOwner && !isDecided && (
          <p className="text-sm text-gray-500">
            An admin or supervisor can approve or reject this channel at any time — there's no separate "submit" step.
          </p>
        )}

        {/* Admin/Supervisor: give negotiation guidance during price check */}
        {canGiveGuidance && (
          <div className="border-t border-gray-100 pt-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Target price (₹) — max cap</label>
              <input
                type="number"
                autoComplete="off"
                value={targetPriceInput}
                onChange={(e) => setTargetPriceInput(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Bid price (₹) — opening offer</label>
              <input
                type="number"
                autoComplete="off"
                value={bidPriceInput}
                onChange={(e) => setBidPriceInput(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm w-40"
              />
            </div>
            <button
              disabled={busy || (!targetPriceInput && !bidPriceInput)}
              onClick={sendGuidance}
              className="rounded bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-40"
            >
              Send guidance
            </button>
          </div>
        )}

        {guidanceLog.length > 0 && (
          <div className="border-t border-gray-100 pt-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Guidance history</h4>
            <ul className="space-y-1">
              {guidanceLog.map((g) => (
                <li key={g.id} className="text-xs text-gray-500 flex justify-between">
                  <span>
                    Target {g.target_price ? `₹${g.target_price.toLocaleString('en-IN')}` : '—'} · Bid{' '}
                    {g.bid_price ? `₹${g.bid_price.toLocaleString('en-IN')}` : '—'}
                    {g.setter?.name ? ` — by ${g.setter.name}` : ''}
                  </span>
                  <span>{new Date(g.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isDecided && isSupervisor && !canGiveGuidance && (approval.asking_price != null || approval.negotiated_price != null) && (
          <p className="text-sm text-gray-500 border-t border-gray-100 pt-4">
            This price is above your approval limit{supervisorLimit ? ` (₹${supervisorLimit.toLocaleString('en-IN')})` : ''} — an admin or higher-limit supervisor needs to respond.
          </p>
        )}

        {/* Admin/Supervisor: approve or reject */}
        {canDecide && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            {!showRejectBox ? (
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={busy}
                  onClick={() => decide('approved')}
                  className="rounded bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  disabled={busy}
                  onClick={() => setShowRejectBox(true)}
                  className="rounded bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Reason for rejection…"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  rows={2}
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={busy}
                    onClick={() => decide('rejected')}
                    className="rounded bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-40"
                  >
                    Confirm rejection
                  </button>
                  <button onClick={() => setShowRejectBox(false)} className="text-sm text-gray-500 hover:underline">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {!isDecided && isSupervisor && !canDecide && (
          <p className="text-sm text-gray-500 border-t border-gray-100 pt-4">
            {approval.negotiated_price == null
              ? 'No price has been set on this channel — only an Admin can approve or reject it.'
              : `This negotiated price is above your approval limit${supervisorLimit ? ` (₹${supervisorLimit.toLocaleString('en-IN')})` : ''} — an admin or higher-limit supervisor needs to decide.`}
          </p>
        )}

        {/* Admin/Supervisor: end an already-live deal */}
        {canEndDeal && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            {!showEndDealBox ? (
              <button
                disabled={busy}
                onClick={() => setShowEndDealBox(true)}
                className="rounded bg-gray-700 text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
              >
                End deal
              </button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={endReason}
                  onChange={(e) => setEndReason(e.target.value)}
                  placeholder="Reason the deal is ending…"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  rows={2}
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={busy}
                    onClick={endDeal}
                    className="rounded bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-40"
                  >
                    Confirm end deal
                  </button>
                  <button onClick={() => setShowEndDealBox(false)} className="text-sm text-gray-500 hover:underline">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Payment period */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4 border-l-4 border-emerald-400">
        <h3 className="font-medium text-gray-800">Payment Period</h3>
        {canEditPaymentTerms ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Billing period</label>
              <select
                value={paymentPeriodUnit}
                onChange={(e) => setPaymentPeriodUnit(e.target.value as PaymentPeriodUnit | '')}
                className="rounded border border-gray-300 px-3 py-2 text-sm w-32"
              >
                <option value="">—</option>
                {PAYMENT_PERIOD_UNITS.map((u) => (
                  <option key={u} value={u}>{PAYMENT_PERIOD_LABELS[u]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Count</label>
              <input
                type="number"
                min={1}
                autoComplete="off"
                value={paymentPeriodCount}
                onChange={(e) => setPaymentPeriodCount(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm w-24"
              />
            </div>
            <button
              disabled={busy}
              onClick={savePaymentTerms}
              className="rounded bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-40"
            >
              Save payment terms
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-800">{formatPaymentTerms(approval) ?? 'Not set yet.'}</p>
        )}
        {estimatedEndDate(approval) && (
          <p className="text-xs text-gray-500">
            First payment due: {estimatedEndDate(approval)!.toLocaleDateString()} — see Billing for ongoing reminders
          </p>
        )}
      </section>

      {/* Proof trail */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4 border-l-4 border-violet-400">
        <h3 className="font-medium text-gray-800">Proof trail</h3>

        {proofs.length === 0 && <p className="text-sm text-gray-400">No proof uploaded yet.</p>}

        <ul className="space-y-2">
          {proofs.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
              <div>
                <span className="font-medium text-gray-700">{p.stage.replace('_', ' ')}</span>
                <span className="text-gray-400"> · {p.file_type.replace('_', ' ')}</span>
                {p.caption && <span className="text-gray-500"> — {p.caption}</span>}
                <div className="text-xs text-gray-400">{new Date(p.uploaded_at).toLocaleString()}</div>
              </div>
              <button onClick={() => handleViewProof(p.file_url)} className="text-telegram-600 hover:underline">
                View
              </button>
            </li>
          ))}
        </ul>

        {isOwner && approval.status !== 'approved' && (
          <form onSubmit={handleUploadProof} className="border-t border-gray-100 pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Stage</label>
                <select
                  value={proofStage}
                  onChange={(e) => setProofStage(e.target.value as ProofStage)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {PROOF_STAGES.map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">File (screenshot / recording)</label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                />
              </div>
            </div>
            <input
              value={proofCaption}
              onChange={(e) => setProofCaption(e.target.value)}
              placeholder="Optional caption"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !proofFile}
              className="rounded bg-gray-800 text-white px-4 py-2 text-sm font-medium hover:bg-gray-900 disabled:opacity-40"
            >
              {busy ? 'Uploading…' : 'Upload proof'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}


function Field({
  label,
  value,
  editable,
  type = 'text',
  onSave,
}: {
  label: string
  value: string | null
  editable: boolean
  type?: 'text' | 'number' | 'date'
  onSave: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  if (!editable) {
    return (
      <div>
        <div className="text-gray-500">{label}</div>
        <div className="text-gray-800">{value ?? '—'}</div>
      </div>
    )
  }

  if (!editing) {
    return (
      <div>
        <div className="text-gray-500">{label}</div>
        <button
          type="button"
          onClick={() => { setDraft(value ?? ''); setEditing(true) }}
          className="text-gray-800 hover:underline text-left"
        >
          {value ?? <span className="text-gray-400">Click to set</span>}
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="text-gray-500">{label}</div>
      <input
        autoFocus
        autoComplete="off"
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onSave(draft) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { setEditing(false); onSave(draft) }
        }}
        className="w-full rounded border border-gray-300 px-2 py-1"
      />
    </div>
  )
}
