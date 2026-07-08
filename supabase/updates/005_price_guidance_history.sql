-- Keep a running history of target/bid price guidance given by admin/supervisor,
-- instead of only remembering the latest value.

create table public.price_guidance_log (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.approvals (id) on delete cascade,
  set_by uuid not null references public.profiles (id),
  target_price numeric,
  bid_price numeric,
  created_at timestamptz not null default now()
);

alter table public.price_guidance_log enable row level security;

create policy "guidance log: visible with approval" on public.price_guidance_log for select
  using (exists (
    select 1 from public.approvals a where a.id = approval_id and (
      a.submitted_by = auth.uid() or public.current_role() in ('admin', 'supervisor')
    )
  ));

create policy "guidance log: admin/supervisor insert" on public.price_guidance_log for insert
  with check (
    public.current_role() = 'admin'
    or (
      public.current_role() = 'supervisor'
      and exists (
        select 1 from public.approvals a where a.id = approval_id and (
          (a.asking_price is not null and a.asking_price <= public.current_approval_limit())
          or (a.negotiated_price is not null and a.negotiated_price <= public.current_approval_limit())
        )
      )
    )
  );
