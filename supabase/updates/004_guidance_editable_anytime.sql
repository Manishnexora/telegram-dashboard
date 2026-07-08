-- Let a supervisor keep giving/adjusting guidance (target/bid price) or decide
-- (approve/reject) at any stage, as long as EITHER the asking price or the
-- current negotiated price is within their limit — not just during the
-- 'price_check' status. Admin is unaffected (already unconditional).

drop policy "approvals: update" on public.approvals;
create policy "approvals: update" on public.approvals for update
  using (
    (submitted_by = auth.uid() and status in ('draft', 'price_check', 'rejected'))
    or public.current_role() = 'admin'
    or (
      public.current_role() = 'supervisor'
      and status in ('draft', 'price_check', 'pending')
      and (
        (asking_price is not null and asking_price <= public.current_approval_limit())
        or (negotiated_price is not null and negotiated_price <= public.current_approval_limit())
      )
    )
  );
