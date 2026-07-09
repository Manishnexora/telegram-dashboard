create table public.channel_stats_history (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  subscribers integer,
  views integer,
  likes integer,
  recorded_at timestamptz not null default now()
);

create index if not exists channel_stats_history_channel_id_idx
  on public.channel_stats_history (channel_id, recorded_at);

alter table public.channel_stats_history enable row level security;

-- Same visibility rule as the parent channel (mirrors "rentals: visible with channel").
create policy "stats history: visible with channel" on public.channel_stats_history for select
  using (exists (
    select 1 from public.channels c where c.id = channel_id
      and (public.current_role() in ('admin', 'supervisor') or c.managed_by = auth.uid())
  ));

-- Needed so the existing manual "Refresh stats" button (which runs as the
-- logged-in user, not service_role) can also record a snapshot. The
-- scheduled snapshot function uses service_role and bypasses RLS entirely.
create policy "stats history: owner or admin/supervisor insert" on public.channel_stats_history for insert
  with check (exists (
    select 1 from public.channels c where c.id = channel_id
      and (c.managed_by = auth.uid() or public.current_role() in ('admin', 'supervisor'))
  ));
