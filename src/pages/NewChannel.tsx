import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadProofFile } from '../lib/proofs'
import { fetchTelegramStats } from '../lib/telegramStats'
import { useAuth } from '../context/AuthContext'

export function NewChannel() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [niche, setNiche] = useState('')
  const [audienceGeo, setAudienceGeo] = useState('')
  const [channelCreatedDate, setChannelCreatedDate] = useState('')
  const [subscribers, setSubscribers] = useState('')
  const [views, setViews] = useState('')
  const [likes, setLikes] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [socialLink, setSocialLink] = useState('')
  const [channelCode, setChannelCode] = useState('')
  const [whatsappLink, setWhatsappLink] = useState('')
  const [criteria, setCriteria] = useState('')
  const [previousDealCompany, setPreviousDealCompany] = useState('')
  const [previousDealFiles, setPreviousDealFiles] = useState<File[]>([])
  const [previousDealAmount, setPreviousDealAmount] = useState('')
  const [previousDealCaption, setPreviousDealCaption] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fetchingStats, setFetchingStats] = useState(false)
  const [statsNotes, setStatsNotes] = useState<string[]>([])

  async function handleHandleBlur() {
    if (!handle.trim()) return
    setFetchingStats(true)
    setStatsNotes([])
    try {
      const stats = await fetchTelegramStats(handle)
      if (stats.channel_name) setName(stats.channel_name)
      if (stats.subscribers != null) setSubscribers(String(stats.subscribers))
      if (stats.avg_views != null) setViews(String(stats.avg_views))
      if (stats.avg_reactions != null) setLikes(String(stats.avg_reactions))
      setStatsNotes(stats.notes)
    } catch (err) {
      setStatsNotes([err instanceof Error ? err.message : String(err)])
    } finally {
      setFetchingStats(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError(null)
    setSubmitting(true)

    const { data: channel, error: channelErr } = await supabase
      .from('channels')
      .insert({
        name,
        handle: handle || null,
        niche: niche || null,
        audience_geo: audienceGeo || null,
        channel_created_date: channelCreatedDate || null,
        subscribers: subscribers ? Number(subscribers) : null,
        views: views ? Number(views) : null,
        likes: likes ? Number(likes) : null,
        owner_name: ownerName || null,
        social_link: socialLink || null,
        channel_code: channelCode || null,
        whatsapp_link: whatsappLink || null,
        criteria: criteria || null,
        previous_deal_company: previousDealCompany || null,
        previous_deal_amount: previousDealAmount ? Number(previousDealAmount) : null,
        managed_by: profile.id,
      })
      .select()
      .single()

    if (channelErr || !channel) {
      setError(channelErr?.message ?? 'Could not create channel')
      setSubmitting(false)
      return
    }

    const { data: approval, error: approvalErr } = await supabase
      .from('approvals')
      .insert({
        channel_id: channel.id,
        submitted_by: profile.id,
        status: 'draft',
      })
      .select()
      .single()

    if (approvalErr || !approval) {
      setSubmitting(false)
      setError(approvalErr?.message ?? 'Could not create approval')
      return
    }

    const previousDealNote = [
      previousDealCompany ? `Company: ${previousDealCompany}` : null,
      previousDealAmount ? `Previous deal amount: ₹${Number(previousDealAmount).toLocaleString('en-IN')}` : null,
      previousDealCaption || null,
    ].filter(Boolean).join(' — ')

    for (const file of previousDealFiles) {
      try {
        const path = await uploadProofFile(approval.id, file)
        await supabase.from('negotiation_proofs').insert({
          approval_id: approval.id,
          uploaded_by: profile.id,
          stage: 'previous_deal',
          file_type: file.type.startsWith('video') ? 'screen_recording' : 'screenshot',
          file_url: path,
          caption: previousDealNote || null,
        })
      } catch (err) {
        setError('Channel created, but a previous-deal file failed to upload: ' + (err instanceof Error ? err.message : String(err)))
      }
    }

    setSubmitting(false)
    navigate(`/channels/${channel.id}`)
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">➕</span>
        <h2 className="text-lg font-semibold text-gray-800">Add a channel</h2>
      </div>

      <form onSubmit={handleSubmit} autoComplete="off" className="bg-white rounded-lg shadow p-6 space-y-4 border-l-4 border-teal-400">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Channel name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Handle / link</label>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onBlur={handleHandleBlur}
            placeholder="@channelname"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          {fetchingStats && <p className="text-xs text-gray-400">Fetching stats from Telegram…</p>}
          {!fetchingStats && statsNotes.length > 0 && (
            <ul className="text-xs text-amber-600 space-y-0.5">
              {statsNotes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Niche</label>
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Audience / geo</label>
            <input
              value={audienceGeo}
              onChange={(e) => setAudienceGeo(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Owner name</label>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Channel code</label>
            <input
              value={channelCode}
              onChange={(e) => setChannelCode(e.target.value)}
              placeholder="Internal reference code"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">YouTube / Instagram link</label>
            <input
              value={socialLink}
              onChange={(e) => setSocialLink(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">WhatsApp link</label>
            <input
              value={whatsappLink}
              onChange={(e) => setWhatsappLink(e.target.value)}
              placeholder="wa.me/..."
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Channel creation date (its age)</label>
          <input
            type="date"
            value={channelCreatedDate}
            onChange={(e) => setChannelCreatedDate(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Subscribers</label>
            <input
              type="number"
              value={subscribers}
              onChange={(e) => setSubscribers(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Avg. views</label>
            <input
              type="number"
              value={views}
              onChange={(e) => setViews(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Avg. likes</label>
            <input
              type="number"
              value={likes}
              onChange={(e) => setLikes(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Criteria</label>
          <textarea
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            rows={2}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <label className="block text-sm font-medium text-gray-700">
            Previous deal <span className="text-gray-400">(optional)</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">Company name</label>
              <input
                value={previousDealCompany}
                onChange={(e) => setPreviousDealCompany(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">Amount (₹)</label>
              <input
                type="number"
                autoComplete="off"
                value={previousDealAmount}
                onChange={(e) => setPreviousDealAmount(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700 pt-2">
            Proof <span className="text-gray-400">(optional)</span>
          </label>
          <p className="text-xs text-gray-400">
            If you've worked with this channel/owner before, attach screenshots or recordings proving that past deal.
          </p>
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => setPreviousDealFiles(Array.from(e.target.files ?? []))}
            className="w-full text-sm"
          />
          {previousDealFiles.length > 0 && (
            <input
              value={previousDealCaption}
              onChange={(e) => setPreviousDealCaption(e.target.value)}
              placeholder="Optional caption for these files"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-telegram-600 text-white px-4 py-2 text-sm font-medium hover:bg-telegram-700 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create channel'}
        </button>
      </form>
    </div>
  )
}
