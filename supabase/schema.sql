-- ============================================================
-- Telegram Dashboard — Phase 1 schema
-- Run this once in Supabase's SQL Editor.
-- ============================================================

-- 1. Profiles: one row per team member, linked to Supabase Auth.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null,
  role text not null default 'teammate' check (role in ('admin', 'supervisor', 'teammate')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone new signs in for the first time.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Supervisor approval limits.
create table public.supervisor_limits (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  approval_limit numeric not null,
  currency text not null default 'INR'
);

-- 3. Channels.
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text,
  telegram_id text,
  niche text,
  audience_geo text,
  channel_created_date date,
  subscribers integer,
  views integer,
  likes integer,
  managed_by uuid not null references public.profiles (id),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  -- Manual-entry-only fields for the expanded Live Deals table (not covered
  -- by the Telegram auto-fetch).
  owner_name text,
  social_link text,
  channel_code text,
  whatsapp_link text,
  previous_deal_company text,
  previous_deal_amount numeric,
  criteria text,
  created_at timestamptz not null default now()
);

-- 4. Channel rentals: the brokerage terms (current state per channel).
create table public.channel_rentals (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null unique references public.channels (id) on delete cascade,
  external_owner_name text,
  external_owner_contact text,
  asking_price numeric,
  target_price numeric,
  negotiated_price numeric,
  cost_period text check (cost_period in ('per_post', 'per_day', 'per_month')),
  client_price numeric,
  currency text not null default 'INR',
  availability text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Approvals: the negotiation/approval workflow + audit trail.
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id),
  asking_price numeric,
  target_price numeric,
  bid_price numeric,
  negotiated_price numeric,
  status text not null default 'draft' check (status in ('draft', 'price_check', 'pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text,
  -- Deal lifecycle: status stays 'approved' forever once approved — ending a
  -- live deal (e.g. the owner backed out) just stamps when/why/who, mirroring
  -- decided_by/decided_at/decision_note. "Live" = approved AND ended_at is null.
  ended_at timestamptz,
  ended_by uuid references public.profiles (id),
  end_note text,
  payment_period_unit text check (payment_period_unit in ('day', 'week', 'month')),
  payment_period_count integer check (payment_period_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Negotiation proofs: the full evidence trail per approval.
create table public.negotiation_proofs (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.approvals (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  stage text not null check (stage in ('previous_deal', 'first_contact', 'asking_price', 'negotiation', 'final_agreement', 'payment')),
  file_type text not null check (file_type in ('screenshot', 'screen_recording')),
  file_url text not null,
  caption text,
  uploaded_at timestamptz not null default now()
);

-- 7. Price guidance log: a running history of target/bid price guidance given
-- by admin/supervisor (each update to approvals.target_price/bid_price also
-- appends a row here, so past guidance isn't lost when it changes).
create table public.price_guidance_log (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.approvals (id) on delete cascade,
  set_by uuid not null references public.profiles (id),
  target_price numeric,
  bid_price numeric,
  created_at timestamptz not null default now()
);

-- Automatically stamp approvals.updated_at on every change, so the Approval
-- Queue can show a genuine "waiting since" time instead of the insert time.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger approvals_set_updated_at
  before update on public.approvals
  for each row execute procedure public.set_updated_at();

-- 8. Payments: real received-payment records against a deal (billing history).
-- Recurring due dates are computed in the app from approvals.decided_at +
-- payment_period_unit/count and the latest recorded payment here — not
-- pre-generated as rows.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.approvals (id) on delete cascade,
  amount numeric not null,
  paid_at date not null,
  recorded_by uuid not null references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Helper functions (used inside the security rules below —
-- written this way to avoid a table checking its own rules
-- against itself, which Postgres doesn't allow).
-- ============================================================

create function public.current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.current_approval_limit()
returns numeric
language sql
security definer
stable
set search_path = public
as $$
  select approval_limit from public.supervisor_limits where user_id = auth.uid();
$$;

-- ============================================================
-- Row Level Security — who can see/change what, enforced by
-- the database itself (not just hidden in the app's screens).
-- ============================================================

alter table public.profiles enable row level security;
alter table public.supervisor_limits enable row level security;
alter table public.channels enable row level security;
alter table public.channel_rentals enable row level security;
alter table public.approvals enable row level security;
alter table public.negotiation_proofs enable row level security;
alter table public.price_guidance_log enable row level security;

-- profiles: any signed-in team member can see names; only admin edits roles.
create policy "profiles: read all" on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles: admin manages" on public.profiles for update using (public.current_role() = 'admin');

-- supervisor_limits: everyone signed-in can read (needed to route submissions); only admin writes.
create policy "limits: read all" on public.supervisor_limits for select using (auth.role() = 'authenticated');
create policy "limits: admin writes" on public.supervisor_limits for all
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- channels: admins & supervisors see every channel; teammates see only their own.
create policy "channels: admin/supervisor read all" on public.channels for select
  using (public.current_role() in ('admin', 'supervisor') or managed_by = auth.uid());
create policy "channels: teammate inserts own" on public.channels for insert
  with check (managed_by = auth.uid() or public.current_role() = 'admin');
create policy "channels: owner or admin updates" on public.channels for update
  using (managed_by = auth.uid() or public.current_role() = 'admin');

-- channel_rentals: visibility/edit rights follow the parent channel.
create policy "rentals: visible with channel" on public.channel_rentals for select
  using (exists (
    select 1 from public.channels c
    where c.id = channel_id
      and (public.current_role() in ('admin', 'supervisor') or c.managed_by = auth.uid())
  ));
create policy "rentals: owner or admin insert" on public.channel_rentals for insert
  with check (exists (
    select 1 from public.channels c where c.id = channel_id
      and (c.managed_by = auth.uid() or public.current_role() = 'admin')
  ));
create policy "rentals: owner or admin update" on public.channel_rentals for update
  using (exists (
    select 1 from public.channels c where c.id = channel_id
      and (c.managed_by = auth.uid() or public.current_role() = 'admin')
  ));

-- approvals: teammates see/edit their own; admin and supervisors see the full portfolio
-- (a supervisor's approval limit only gates whether they can actually approve/reject —
-- see the update policy below — not whether they can see it).
create policy "approvals: read" on public.approvals for select
  using (
    submitted_by = auth.uid()
    or public.current_role() in ('admin', 'supervisor')
  );
create policy "approvals: teammate insert own" on public.approvals for insert
  with check (submitted_by = auth.uid() or public.current_role() = 'admin');
-- Approve/Reject, and giving/adjusting guidance (target/bid price), is allowed
-- at any stage (draft/price_check/pending) — needed for collaboration channels
-- with no price negotiation, and so a supervisor can keep adjusting guidance
-- as a negotiation evolves. A supervisor can act whenever EITHER the asking
-- price or the current negotiated price is within their limit; a price-less
-- channel is admin-only.
-- 'approved' is included here (not just draft/price_check/pending) so an
-- eligible supervisor can also use the "End Deal" action on a live deal.
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

-- negotiation_proofs: visible to whoever can already see the parent approval.
create policy "proofs: visible with approval" on public.negotiation_proofs for select
  using (exists (
    select 1 from public.approvals a where a.id = approval_id and (
      a.submitted_by = auth.uid() or public.current_role() in ('admin', 'supervisor')
    )
  ));
create policy "proofs: teammate insert on own approval" on public.negotiation_proofs for insert
  with check (exists (
    select 1 from public.approvals a where a.id = approval_id
      and (a.submitted_by = auth.uid() or public.current_role() = 'admin')
  ));

-- price_guidance_log: visible to whoever can see the parent approval;
-- insertable by admin, or a supervisor eligible on that approval's price.
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

-- payments: Billing is an admin/supervisor-only area — teammates don't need
-- to track payment reminders/history themselves.
alter table public.payments enable row level security;
create policy "payments: admin/supervisor read" on public.payments for select
  using (public.current_role() in ('admin', 'supervisor'));
create policy "payments: admin/supervisor insert" on public.payments for insert
  with check (public.current_role() in ('admin', 'supervisor'));

-- ============================================================
-- Storage bucket for proof screenshots/recordings.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;

create policy "proofs bucket: authenticated read"
on storage.objects for select
using (bucket_id = 'proofs' and auth.role() = 'authenticated');

create policy "proofs bucket: authenticated upload"
on storage.objects for insert
with check (bucket_id = 'proofs' and auth.role() = 'authenticated');
