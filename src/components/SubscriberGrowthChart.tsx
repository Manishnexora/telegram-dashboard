import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ChannelStatsSnapshot } from '../types'

interface SubscriberGrowthChartProps {
  history: ChannelStatsSnapshot[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function SubscriberGrowthChart({ history }: SubscriberGrowthChartProps) {
  const points = history
    .filter((h) => h.subscribers != null)
    .map((h) => ({ date: formatDate(h.recorded_at), subscribers: h.subscribers }))

  if (points.length < 2) {
    return (
      <p className="text-xs text-gray-400">
        Growth chart will appear once a few days of data have been collected.
      </p>
    )
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={48} />
          <Tooltip formatter={(value) => Number(value ?? 0).toLocaleString('en-IN')} />
          <Line type="monotone" dataKey="subscribers" stroke="#0088CC" strokeWidth={2} dot={false} name="Subscribers" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
