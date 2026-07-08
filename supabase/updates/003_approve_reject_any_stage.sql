-- Allow Approve/Reject at any stage (draft/price_check/pending), not just
-- after a formal "pending" submission — needed for collaboration channels
-- that have no price negotiation at all. Admin can always decide. A
-- supervisor can only decide once a negotiated_price is set and it's within
-- their own limit (a channel with no price at all is admin-only).

drop policy "approvals: update" on public.approvals;
create policy "approvals: update" on public.approvals for update
  using (
    (submitted_by = auth.uid() and status in ('draft', 'price_check', 'rejected'))
    or public.current_role() = 'admin'
    or (
      public.current_role() = 'supervisor'
      and status in ('draft', 'price_check', 'pending')
      and (
        (status = 'price_check' and asking_price is not null and asking_price <= public.current_approval_limit())
        or (negotiated_price is not null and negotiated_price <= public.current_approval_limit())
      )
    )
  );
