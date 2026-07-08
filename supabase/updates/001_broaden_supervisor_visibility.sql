-- Fix: supervisors should see the FULL portfolio (all channels/approvals/proofs,
-- any status), not just submissions within their own approval limit.
-- The approval limit should only gate whether they can actually approve/reject
-- a submission (already enforced separately by the update policies) — not
-- whether they can see it in the first place.

drop policy "approvals: read" on public.approvals;
create policy "approvals: read" on public.approvals for select
  using (
    submitted_by = auth.uid()
    or public.current_role() in ('admin', 'supervisor')
  );

drop policy "proofs: visible with approval" on public.negotiation_proofs;
create policy "proofs: visible with approval" on public.negotiation_proofs for select
  using (exists (
    select 1 from public.approvals a where a.id = approval_id and (
      a.submitted_by = auth.uid() or public.current_role() in ('admin', 'supervisor')
    )
  ));
