-- Billing: a "payments" table logs actual received payments against a deal
-- (real records, not just computed due dates), powering both the upcoming-
-- payment reminders and the billing history log. Recurring due dates are
-- computed in the app from approvals.decided_at + payment_period_unit/count
-- and the latest recorded payment — not stored as rows here.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.approvals (id) on delete cascade,
  amount numeric not null,
  paid_at date not null,
  recorded_by uuid not null references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;

-- Billing is an admin/supervisor-only area (per explicit decision — teammates
-- don't need to track payment reminders/history themselves).
create policy "payments: admin/supervisor read" on public.payments for select
  using (public.current_role() in ('admin', 'supervisor'));

create policy "payments: admin/supervisor insert" on public.payments for insert
  with check (public.current_role() in ('admin', 'supervisor'));
