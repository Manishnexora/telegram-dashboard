-- Automatically stamp `updated_at` on the approvals table whenever a row
-- changes, so the Approval Queue can show a genuine "waiting since" time.
-- Previously updated_at was set once at insert and never touched again.
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
