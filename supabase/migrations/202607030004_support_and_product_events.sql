-- Coordiqo go-live: customer support requests and lightweight product events.
--
-- Additive and idempotent.

-- 1. Support requests ------------------------------------------------------------

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  subject text not null,
  message text not null,
  severity text not null default 'normal' check (severity in ('low', 'normal', 'high', 'critical')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'waiting_for_customer', 'resolved', 'archived')),
  assigned_to uuid references public.profiles(id) on delete set null,
  related_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create index if not exists idx_support_requests_company on public.support_requests(company_id, status, created_at desc);
create index if not exists idx_support_requests_status on public.support_requests(status, created_at desc);

drop trigger if exists trg_support_requests_updated_at on public.support_requests;
create trigger trg_support_requests_updated_at before update on public.support_requests
for each row execute procedure public.set_updated_at();

alter table public.support_requests enable row level security;

drop policy if exists support_requests_select on public.support_requests;
create policy support_requests_select on public.support_requests
for select using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists support_requests_insert on public.support_requests;
create policy support_requests_insert on public.support_requests
for insert with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists support_requests_update on public.support_requests;
create policy support_requests_update on public.support_requests
for update
using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));

-- 2. Product events ----------------------------------------------------------------
-- Lightweight internal analytics: no sensitive free text is stored here.

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  company_id uuid references public.companies(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_product_events_key_created on public.product_events(event_key, created_at desc);
create index if not exists idx_product_events_company on public.product_events(company_id, created_at desc) where company_id is not null;

alter table public.product_events enable row level security;

-- Only platform admins may read events; inserts happen server-side via the
-- service role (no anon/authenticated insert policy on purpose).
drop policy if exists product_events_platform_select on public.product_events;
create policy product_events_platform_select on public.product_events
for select using (public.is_platform_admin());

-- 3. Go-live health helper ----------------------------------------------------------
-- Lists public tables without row level security so the admin go-live page can
-- flag security regressions. Only callable meaningfully by the server.

create or replace function public.coordiqo_tables_without_rls()
returns table(table_name text)
language sql
security definer
set search_path = public
as $$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity = false
  order by c.relname;
$$;

revoke all on function public.coordiqo_tables_without_rls() from public;
grant execute on function public.coordiqo_tables_without_rls() to service_role;
