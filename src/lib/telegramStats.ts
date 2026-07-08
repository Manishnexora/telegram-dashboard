import { supabase } from './supabase'

export interface TelegramStatsResult {
  channel_name: string | null
  subscribers: number | null
  avg_views: number | null
  avg_reactions: number | null
  notes: string[]
}

export async function fetchTelegramStats(username: string): Promise<TelegramStatsResult> {
  const { data, error } = await supabase.functions.invoke('telegram-stats', {
    body: { username },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data.data as TelegramStatsResult
}
