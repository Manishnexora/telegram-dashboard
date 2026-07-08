import { STATUS_LABELS, type ApprovalStatus } from '../types'

const COLORS: Record<ApprovalStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  price_check: 'bg-amber-100 text-amber-700',
  pending: 'bg-telegram-100 text-telegram-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export function StatusBadge({
  status,
  size = 'sm',
}: {
  status?: ApprovalStatus
  size?: 'sm' | 'lg'
}) {
  if (!status) return <span className="text-gray-400">—</span>

  const sizeClasses = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-1 text-xs'

  return (
    <span className={`rounded font-medium ${sizeClasses} ${COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
