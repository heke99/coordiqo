-- Coordiqo sales-led onboarding
-- Demo requests, superadmin lead management, temporary-password users and onboarding sessions.
-- Safe/idempotent. Does not delete business data.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists password_changed_at timestamptz,
  add column if not exists created_by_superadmin uuid references public.profiles(id) on delete set null,
  add column if not exists temporary_access_created_at timestamptz;

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  organization_number text,
  contact_name text not null,
  email text not null,
  phone text,
  industry text,
  employee_count text,
  weekly_jobs_count text,
  needs text[] not null default '{}',
  preferred_language text not null default 'sv' check (preferred_language in ('sv', 'en')),
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'demo_booked', 'offer_sent', 'won', 'lost', 'onboarding_started')),
  source text not null default 'website',
  next_contact_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  created_company_id uuid references public.companies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.demo_request_notes (
  id uuid primary key default gen_random_uuid(),
  demo_request_id uuid not null references public.demo_requests(id) on delete cascade,
  note text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.company_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  demo_request_id uuid references public.demo_requests(id) on delete set null,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  current_step text not null default 'company_information',
  completed_steps text[] not null default '{}',
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(company_id)
);

create index if not exists demo_requests_status_idx on public.demo_requests(status);
create index if not exists demo_requests_created_at_idx on public.demo_requests(created_at desc);
create index if not exists demo_requests_email_idx on public.demo_requests(lower(email));
create index if not exists demo_requests_organization_number_idx on public.demo_requests(organization_number) where organization_number is not null;
create index if not exists demo_requests_assigned_to_idx on public.demo_requests(assigned_to) where assigned_to is not null;
create index if not exists demo_requests_next_contact_at_idx on public.demo_requests(next_contact_at) where next_contact_at is not null;
create index if not exists demo_request_notes_request_idx on public.demo_request_notes(demo_request_id, created_at desc);
create index if not exists company_onboarding_sessions_company_idx on public.company_onboarding_sessions(company_id, status);

drop trigger if exists trg_demo_requests_updated_at on public.demo_requests;
create trigger trg_demo_requests_updated_at before update on public.demo_requests
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_company_onboarding_sessions_updated_at on public.company_onboarding_sessions;
create trigger trg_company_onboarding_sessions_updated_at before update on public.company_onboarding_sessions
for each row execute procedure public.set_updated_at();

alter table public.demo_requests enable row level security;
alter table public.demo_request_notes enable row level security;
alter table public.company_onboarding_sessions enable row level security;

drop policy if exists demo_requests_public_insert on public.demo_requests;
create policy demo_requests_public_insert on public.demo_requests
for insert
with check (true);

drop policy if exists demo_requests_platform_select on public.demo_requests;
create policy demo_requests_platform_select on public.demo_requests
for select
using (public.is_platform_admin());

drop policy if exists demo_requests_platform_update on public.demo_requests;
create policy demo_requests_platform_update on public.demo_requests
for update
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists demo_requests_platform_delete on public.demo_requests;
create policy demo_requests_platform_delete on public.demo_requests
for delete
using (public.is_platform_admin());

drop policy if exists demo_request_notes_platform_select on public.demo_request_notes;
create policy demo_request_notes_platform_select on public.demo_request_notes
for select
using (public.is_platform_admin());

drop policy if exists demo_request_notes_platform_insert on public.demo_request_notes;
create policy demo_request_notes_platform_insert on public.demo_request_notes
for insert
with check (public.is_platform_admin());

drop policy if exists demo_request_notes_platform_delete on public.demo_request_notes;
create policy demo_request_notes_platform_delete on public.demo_request_notes
for delete
using (public.is_platform_admin());

drop policy if exists company_onboarding_sessions_select on public.company_onboarding_sessions;
create policy company_onboarding_sessions_select on public.company_onboarding_sessions
for select
using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));

drop policy if exists company_onboarding_sessions_write on public.company_onboarding_sessions;
create policy company_onboarding_sessions_write on public.company_onboarding_sessions
for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));

create or replace view public.coordiqo_demo_request_readiness_v
with (security_invoker = true)
as
select
  count(*) as total_leads,
  count(*) filter (where status = 'new') as new_leads,
  count(*) filter (where status = 'contacted') as contacted_leads,
  count(*) filter (where status = 'demo_booked') as demo_booked_leads,
  count(*) filter (where status = 'offer_sent') as offer_sent_leads,
  count(*) filter (where status = 'won') as won_leads,
  count(*) filter (where status = 'lost') as lost_leads,
  count(*) filter (where status = 'onboarding_started') as onboarding_started_leads
from public.demo_requests;

