import { createClient } from 'npm:@supabase/supabase-js@2'
import { scrapeChannelStats } from '../_shared/telegramScrape.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Runs on a schedule (Supabase Cron), not on behalf of a logged-in user —
// gated by a shared secret instead of a user JWT.
Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return json({ error: 'Forbidden' }, 403)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: channels, error } = await admin
      .from('channels')
      .select('id, handle, subscribers, views, likes')
      .not('handle', 'is', null)
      .eq('status', 'active')

    if (error) return json({ error: error.message }, 500)

    let processed = 0
    let failed = 0

    for (const channel of channels ?? []) {
      try {
        const stats = await scrapeChannelStats(channel.handle!)

        const subscribers = stats.subscribers ?? channel.subscribers
        const views = stats.avg_views ?? channel.views
        const likes = stats.avg_reactions ?? channel.likes

        await admin.from('channels').update({ subscribers, views, likes }).eq('id', channel.id)
        await admin.from('channel_stats_history').insert({
          channel_id: channel.id,
          subscribers,
          views,
          likes,
        })

        processed++
      } catch {
        failed++
      }

      // Small delay between channels so we don't hammer Telegram's servers.
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    return json({ data: { processed, failed } })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
