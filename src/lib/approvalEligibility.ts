import type { Approval } from '../types'

export function supervisorEligible(
  approval: Pick<Approval, 'asking_price' | 'negotiated_price'>,
  supervisorLimit: number | null
): boolean {
  if (supervisorLimit == null) return false
  const askingOk = approval.asking_price != null && approval.asking_price <= supervisorLimit
  const negotiatedOk = approval.negotiated_price != null && approval.negotiated_price <= supervisorLimit
  return askingOk || negotiatedOk
}
