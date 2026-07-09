-- Postgres does not auto-index foreign key columns (only primary/unique keys).
-- Every page load joins channels -> approvals -> profiles, and RLS policies
-- add their own exists(...) subqueries on these same columns — without
-- indexes, each of those is a full table scan. This is the main cause of
-- slow navigation as the tables grow.

create index if not exists channels_managed_by_idx on public.channels (managed_by);

create index if not exists approvals_channel_id_idx on public.approvals (channel_id);
create index if not exists approvals_submitted_by_idx on public.approvals (submitted_by);
create index if not exists approvals_decided_by_idx on public.approvals (decided_by);
create index if not exists approvals_ended_by_idx on public.approvals (ended_by);

create index if not exists negotiation_proofs_approval_id_idx on public.negotiation_proofs (approval_id);
create index if not exists negotiation_proofs_uploaded_by_idx on public.negotiation_proofs (uploaded_by);

create index if not exists price_guidance_log_approval_id_idx on public.price_guidance_log (approval_id);
create index if not exists price_guidance_log_set_by_idx on public.price_guidance_log (set_by);

create index if not exists payments_approval_id_idx on public.payments (approval_id);
create index if not exists payments_recorded_by_idx on public.payments (recorded_by);
