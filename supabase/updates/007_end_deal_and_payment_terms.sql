-- "End Deal" support (manually terminating an already-approved/live deal —
-- e.g. the channel owner backed out mid-arrangement) plus payment terms
-- (billing period + count) on the approval, so the app can tell which
-- deals are still "live" and roughly when a deal is due to end.
--
-- A deal counts as "live" once approved and stays live until ended_at is
-- set — there is no automatic expiry. Column naming mirrors the existing
-- decided_by / decided_at / decision_note trio.

alter table public.approvals
  add column ended_at timestamptz,
  add column ended_by uuid references public.profiles (id),
  add column end_note text,
  add column payment_period_unit text check (payment_period_unit in ('day', 'week', 'month')),
  add column payment_period_count integer check (payment_period_count > 0);

-- Broaden the supervisor branch of the update policy to also cover
-- 'approved' — ending a live deal is an update to an already-approved
-- row, and an eligible supervisor (by asking/negotiated price vs. their
-- limit) should be able to do it, same as they could approve it.
drop policy "approvals: update" on public.approvals;
create policy "approvals: update" on public.approvals for update
  using (
    (submitted_by = auth.uid() and status in ('draft', 'price_check', 'rejected'))
    or public.current_role() = 'admin'
    or (
      public.current_role() = 'supervisor'
      and status in ('draft', 'price_check', 'pending', 'approved')
      and (
        (asking_price is not null and asking_price <= public.current_approval_limit())
        or (negotiated_price is not null and negotiated_price <= public.current_approval_limit())
      )
    )
  );
