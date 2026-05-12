create extension if not exists pgcrypto;

create type public.platform_role as enum (
  'owner',
  'platform_admin',
  'support_admin',
  'billing_admin',
  'compliance_admin'
);

create type public.company_status as enum ('active', 'inactive');
create type public.company_membership_role as enum (
  'company_admin',
  'operations_manager',
  'planner',
  'supervisor',
  'dispatcher',
  'team_lead',
  'staff',
  'contractor',
  'read_only'
);
create type public.company_membership_status as enum ('invited', 'active', 'disabled');
create type public.team_status as enum ('active', 'inactive');

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_number text,
  status public.company_status not null default 'active',
  industry_type text not null default 'other',
  operational_model text not null default 'task_based',
  timezone text not null default 'Europe/Stockholm',
  language_code text not null default 'sv',
  region_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  active_modules text[] not null default '{}',
  ui_label_set text,
  default_maps_provider text not null default 'google_maps',
  allow_impersonation boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  platform_role public.platform_role,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.company_membership_role not null,
  status public.company_membership_status not null default 'invited',
  is_default boolean not null default false,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(company_id, user_id)
);

create unique index if not exists idx_company_memberships_default_per_user
  on public.company_memberships(user_id)
  where is_default = true and status = 'active';

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text,
  description text,
  status public.team_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(company_id, name)
);

create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  membership_id uuid not null references public.company_memberships(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(team_id, membership_id)
);

create unique index if not exists idx_team_memberships_primary_per_membership
  on public.team_memberships(membership_id)
  where is_primary = true;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at before update on public.companies
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_company_settings_updated_at on public.company_settings;
create trigger trg_company_settings_updated_at before update on public.company_settings
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_company_memberships_updated_at on public.company_memberships;
create trigger trg_company_memberships_updated_at before update on public.company_memberships
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_teams_updated_at on public.teams;
create trigger trg_teams_updated_at before update on public.teams
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_team_memberships_updated_at on public.team_memberships;
create trigger trg_team_memberships_updated_at before update on public.team_memberships
for each row execute procedure public.set_updated_at();

create or replace function public.current_platform_role()
returns public.platform_role
language sql
stable
as $$
  select p.platform_role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select public.current_platform_role() in ('owner', 'platform_admin', 'support_admin');
$$;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  );
$$;

create or replace function public.has_company_role(target_company_id uuid, minimum_role public.company_membership_role)
returns boolean
language sql
stable
as $$
  with ranked as (
    select cm.role,
      case cm.role
        when 'company_admin' then 100
        when 'operations_manager' then 90
        when 'planner' then 80
        when 'supervisor' then 70
        when 'dispatcher' then 60
        when 'team_lead' then 50
        when 'staff' then 40
        when 'contractor' then 30
        when 'read_only' then 10
      end as rank
    from public.company_memberships cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  ), wanted as (
    select case minimum_role
      when 'company_admin' then 100
      when 'operations_manager' then 90
      when 'planner' then 80
      when 'supervisor' then 70
      when 'dispatcher' then 60
      when 'team_lead' then 50
      when 'staff' then 40
      when 'contractor' then 30
      when 'read_only' then 10
    end as rank
  )
  select exists (
    select 1 from ranked, wanted where ranked.rank >= wanted.rank
  );
$$;

alter table public.companies enable row level security;
alter table public.company_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.company_memberships enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.audit_logs enable row level security;

create policy "platform admins manage companies"
on public.companies
for all
using (public.is_platform_admin() or public.is_company_member(id))
with check (public.is_platform_admin());

create policy "company settings visible to members"
on public.company_settings
for select
using (public.is_platform_admin() or public.is_company_member(company_id));

create policy "company admins manage settings"
on public.company_settings
for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));

create policy "users can read own profile"
on public.profiles
for select
using (id = auth.uid() or public.is_platform_admin());

create policy "users can update own profile"
on public.profiles
for update
using (id = auth.uid() or public.is_platform_admin())
with check (id = auth.uid() or public.is_platform_admin());

create policy "platform admins can insert profiles"
on public.profiles
for insert
with check (public.is_platform_admin());

create policy "memberships visible to company members"
on public.company_memberships
for select
using (
  user_id = auth.uid()
  or public.is_platform_admin()
  or public.is_company_member(company_id)
);

create policy "company admins manage memberships"
on public.company_memberships
for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));

create policy "teams visible to company members"
on public.teams
for select
using (public.is_platform_admin() or public.is_company_member(company_id));

create policy "company managers manage teams"
on public.teams
for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'));

create policy "team memberships visible to company members"
on public.team_memberships
for select
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.teams t
    where t.id = team_id
      and public.is_company_member(t.company_id)
  )
);

create policy "company managers manage team memberships"
on public.team_memberships
for all
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.teams t
    where t.id = team_id
      and public.has_company_role(t.company_id, 'operations_manager')
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.teams t
    where t.id = team_id
      and public.has_company_role(t.company_id, 'operations_manager')
  )
);

create policy "audit logs visible to managers"
on public.audit_logs
for select
using (
  public.is_platform_admin()
  or (company_id is not null and public.has_company_role(company_id, 'operations_manager'))
);

create policy "authenticated users can insert audit logs"
on public.audit_logs
for insert
with check (
  auth.uid() is not null
  and (company_id is null or public.is_company_member(company_id) or public.is_platform_admin())
);
