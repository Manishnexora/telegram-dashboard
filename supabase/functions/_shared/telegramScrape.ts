export interface TelegramStatsResult {
  channel_name: string | null
  subscribers: number | null
  avg_views: number | null
  avg_reactions: number | null
  notes: string[]
}

// Turns "12 345", "12,345", "1.2K", "3.4M" into a plain integer.
function parseCount(raw: string | null | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/,/g, '').trim()

  const abbreviated = cleaned.match(/^([\d.]+)\s*([KMB])$/i)
  if (abbreviated) {
    const num = parseFloat(abbreviated[1])
    const mult = { K: 1e3, M: 1e6, B: 1e9 }[abbreviated[2].toUpperCase() as 'K' | 'M' | 'B']
    return Math.round(num * mult)
  }

  const digitsOnly = cleaned.replace(/\s+/g, '')
  return /^\d+$/.test(digitsOnly) ? parseInt(digitsOnly, 10) : null
}

function normalizeUsername(input: string): string {
  let s = input.trim()
  s = s.replace(/^https?:\/\/(www\.)?t\.me\//i, '')
  s = s.replace(/^t\.me\//i, '')
  s = s.replace(/^s\//i, '')
  s = s.replace(/^@/, '')
  s = s.split(/[/?]/)[0]
  return s
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TelegramDashboardBot/1.0)' },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

interface PostInfo {
  id: number
  views: number | null
  reactions: number | null
  date: string | null
}

function extractPosts(html: string): PostInfo[] {
  const chunks = html.split('class="tgme_widget_message ').slice(1)
  return chunks
    .map((chunk) => {
      const idMatch = chunk.match(/data-post="[^"]*\/(\d+)"/)
      const viewsMatch = chunk.match(/tgme_widget_message_views">([^<]+)</)
      const dateMatch = chunk.match(/<time[^>]*datetime="([^"]+)"/)
      const reactionMatches = [...chunk.matchAll(/tgme_reaction_count">\s*(\d+)\s*</g)]
      const reactions = reactionMatches.length
        ? reactionMatches.reduce((sum, m) => sum + parseInt(m[1], 10), 0)
        : null

      return {
        id: idMatch ? parseInt(idMatch[1], 10) : null,
        views: viewsMatch ? parseCount(viewsMatch[1]) : null,
        date: dateMatch ? dateMatch[1] : null,
        reactions,
      }
    })
    .filter((p): p is PostInfo => p.id != null)
}

export async function scrapeChannelStats(rawUsername: string): Promise<TelegramStatsResult> {
  const username = normalizeUsername(rawUsername)

  const notes: string[] = []
  let channelName: string | null = null
  let subscribers: number | null = null
  let avgViews: number | null = null
  let avgReactions: number | null = null

  // 1. Channel title + subscriber count from the plain channel preview page.
  const pageHtml = await fetchText(`https://t.me/${username}`)
  if (!pageHtml) {
    notes.push('Could not load the channel preview page — check the handle is correct and the channel is public.')
  } else {
    const titleMatch = pageHtml.match(/<meta property="og:title" content="([^"]*)"/)
    if (titleMatch) channelName = titleMatch[1]

    const subMatch = pageHtml.match(/tgme_page_extra">\s*([^<]+?)\s*subscribers?/i)
    if (subMatch) {
      subscribers = parseCount(subMatch[1])
    } else {
      notes.push('Subscriber count not found — this channel may be private or have its preview turned off.')
    }
  }

  // 2. Recent posts (views/reactions) from the scrollable feed preview.
  // Channel start date is intentionally NOT computed here — walking back
  // through history to find the first post was too slow to do on every
  // fetch, so that field is left for manual entry instead.
  const feedHtml = await fetchText(`https://t.me/s/${username}`)

  if (!feedHtml) {
    notes.push('Could not load recent posts — this channel may be private or have no posts.')
  } else {
    const posts = extractPosts(feedHtml)
    if (posts.length === 0) {
      notes.push('No recent posts found to read views/reactions from.')
    } else {
      const views = posts.map((p) => p.views).filter((v): v is number => v != null)
      if (views.length) avgViews = Math.round(views.reduce((a, b) => a + b, 0) / views.length)

      const reactions = posts.map((p) => p.reactions).filter((r): r is number => r != null)
      if (reactions.length) {
        avgReactions = Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length)
      } else {
        notes.push('Reaction counts were not available on the public preview for this channel.')
      }
    }
  }

  return {
    channel_name: channelName,
    subscribers,
    avg_views: avgViews,
    avg_reactions: avgReactions,
    notes,
  }
}
