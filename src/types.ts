export type Role = 'admin' | 'supervisor' | 'teammate'

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  created_at: string
}

export type ApprovalStatus = 'draft' | 'price_check' | 'pending' | 'approved' | 'rejected'
export type ProofStage = 'previous_deal' | 'first_contact' | 'asking_price' | 'negotiation' | 'final_agreement' | 'payment'
export type FileType = 'screenshot' | 'screen_recording'

export interface Channel {
  id: string
  name: string
  handle: string | null
  telegram_id: string | null
  niche: string | null
  audience_geo: string | null
  channel_created_date: string | null
  subscribers: number | null
  views: number | null
  likes: number | null
  managed_by: string
  status: 'active' | 'paused' | 'archived'
  owner_name: string | null
  social_link: string | null
  channel_code: string | null
  whatsapp_link: string | null
  previous_deal_company: string | null
  previous_deal_amount: number | null
  criteria: string | null
  created_at: string
}

export type PaymentPeriodUnit = 'day' | 'week' | 'month'

export const PAYMENT_PERIOD_UNITS: PaymentPeriodUnit[] = ['day', 'week', 'month']

export const PAYMENT_PERIOD_LABELS: Record<PaymentPeriodUnit, string> = {
  day: 'Day(s)',
  week: 'Week(s)',
  month: 'Month(s)',
}

export interface Approval {
  id: string
  channel_id: string
  submitted_by: string
  asking_price: number | null
  target_price: number | null
  bid_price: number | null
  negotiated_price: number | null
  status: ApprovalStatus
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
  ended_at: string | null
  ended_by: string | null
  end_note: string | null
  payment_period_unit: PaymentPeriodUnit | null
  payment_period_count: number | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  approval_id: string
  amount: number
  paid_at: string
  recorded_by: string
  note: string | null
  created_at: string
  recorder?: { name: string } | null
}

export interface PriceGuidance {
  id: string
  approval_id: string
  set_by: string
  target_price: number | null
  bid_price: number | null
  created_at: string
  setter?: { name: string } | null
}

export interface NegotiationProof {
  id: string
  approval_id: string
  uploaded_by: string
  stage: ProofStage
  file_type: FileType
  file_url: string
  caption: string | null
  uploaded_at: string
}

export const PROOF_STAGES: ProofStage[] = [
  'first_contact',
  'asking_price',
  'negotiation',
  'final_agreement',
  'payment',
]

export const STATUS_LABELS: Record<ApprovalStatus, string> = {
  draft: 'Draft',
  price_check: 'Awaiting price check',
  pending: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
}
