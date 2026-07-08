import type { Approval } from '../types'

export function isLive(a: Pick<Approval, 'status' | 'ended_at'>) {
  return a.status === 'approved' && !a.ended_at
}

export function isHistorical(a: Pick<Approval, 'status' | 'ended_at'>) {
  return a.status === 'rejected' || (a.status === 'approved' && !!a.ended_at)
}
