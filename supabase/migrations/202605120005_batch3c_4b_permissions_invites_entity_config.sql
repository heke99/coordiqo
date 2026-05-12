-- Coordiqo Batch 3C + 4B
-- Organisation hardening, invitations, permission visibility and dynamic entity configuration.

create extension if not exists pgcrypto;

-- Team leadership and operational ownership.
alter table public.teams add column if not exists team_lead_staff_profile_id uuid references public.staff_profiles(id) on delete set null;
alter table public.teams add column if not exists area_label text;

-- Invitation flow is intentionally separate from company_memberships because auth users may not exist yet.
create table if not exists public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'staff' check (role in ('company_admin', 'operations_manager', 'planner', 'supervisor', 'dispatcher', 'team_lead', 'staff', 'contractor', 'read_only')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  token text not null default encode(gen_random_bytes(24), 'hex'),
  message text,
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz not null default timezone('utc', now()) + interval '14 days',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(company_id, email, status)
);

create index if not exists idx_company_invitations_company_status on public.company_invitations(company_id, status);
create index if not exists idx_company_invitations_email on public.company_invitations(lower(email));

-- Permission matrix snapshot for product UI and future override support.
create table if not exists public.company_role_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null check (role in ('company_admin', 'operations_manager', 'planner', 'supervisor', 'dispatcher', 'team_lead', 'staff', 'contractor', 'read_only')),
  permission_key text not null,
  is_allowed boolean not null default false,
  source text not null default 'system_default' check (source in ('system_default', 'company_override')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(company_id, role, permission_key)
);

-- Dynamic fields become manageable and archivable rather than only seeded config.
alter table public.entity_type_fields add column if not exists help_text text;
alter table public.entity_type_fields add column if not exists placeholder text;
alter table public.entity_type_fields add column if not exists archived_at timestamptz;

create index if not exists idx_entity_type_fields_type_active
  on public.entity_type_fields(entity_type_id, sort_order)
  where archived_at is null;

-- Entity relation/document hardening.
alter table public.entity_relations add column if not exists notes text;
alter table public.entity_relations add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.entity_relations add column if not exists archived_at timestamptz;

alter table public.entity_documents add column if not exists description text;
alter table public.entity_documents add column if not exists status text not null default 'active' check (status in ('active', 'archived'));

-- Updated-at trigger coverage.
drop trigger if exists set_company_invitations_updated_at on public.company_invitations;
create trigger set_company_invitations_updated_at
before update on public.company_invitations
for each row execute function public.set_updated_at();

drop trigger if exists set_company_role_permissions_updated_at on public.company_role_permissions;
create trigger set_company_role_permissions_updated_at
before update on public.company_role_permissions
for each row execute function public.set_updated_at();

-- RLS.
alter table public.company_invitations enable row level security;
alter table public.company_role_permissions enable row level security;

-- Entity type fields did not have full direct policies earlier. They are scoped through entity_types.
drop policy if exists "entity type fields visible to company members" on public.entity_type_fields;
create policy "entity type fields visible to company members"
on public.entity_type_fields for select
using (
  exists (
    select 1 from public.entity_types et
    where et.id = entity_type_id
      and (public.is_platform_admin() or public.is_company_member(et.company_id))
  )
);

drop policy if exists "entity type fields managed by operations managers" on public.entity_type_fields;
create policy "entity type fields managed by operations managers"
on public.entity_type_fields for all
using (
  exists (
    select 1 from public.entity_types et
    where et.id = entity_type_id
      and (public.is_platform_admin() or public.has_company_role(et.company_id, 'operations_manager'))
  )
)
with check (
  exists (
    select 1 from public.entity_types et
    where et.id = entity_type_id
      and (public.is_platform_admin() or public.has_company_role(et.company_id, 'operations_manager'))
  )
);

drop policy if exists "company invitations visible to managers" on public.company_invitations;
create policy "company invitations visible to managers"
on public.company_invitations for select
using (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'));

drop policy if exists "company invitations managed by managers" on public.company_invitations;
create policy "company invitations managed by managers"
on public.company_invitations for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'));

drop policy if exists "role permissions visible to company members" on public.company_role_permissions;
create policy "role permissions visible to company members"
on public.company_role_permissions for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "role permissions managed by operations managers" on public.company_role_permissions;
create policy "role permissions managed by operations managers"
on public.company_role_permissions for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'));

-- Extend entity relation policy to ignore archived relations in app queries; RLS remains access-based.
create index if not exists idx_entity_relations_company_parent_active
  on public.entity_relations(company_id, parent_entity_id)
  where archived_at is null;

-- Seed module and permissions for existing companies.
insert into public.platform_modules (code, name, description, is_core, sort_order)
values
  ('organisation', 'Organisation och behörighet', 'Rollmatris, inbjudningar och organisationsstyrning.', false, 28),
  ('entity_configuration', 'Objektkonfiguration', 'Dynamiska objekttyper, fält och relationer.', false, 32)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

insert into public.company_modules (company_id, module_code, status, enabled_at)
select c.id, v.module_code, 'active', timezone('utc', now())
from public.companies c
cross join (values ('organisation'), ('entity_configuration')) as v(module_code)
on conflict (company_id, module_code) do update set
  status = excluded.status,
  enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at),
  updated_at = timezone('utc', now());

update public.company_settings
set active_modules = array(
  select distinct unnest(coalesce(active_modules, '{}'::text[]) || array['organisation', 'entity_configuration'])
),
updated_at = timezone('utc', now())
where true;

-- Default role permission snapshot. The app still enforces permissions in code; this table gives admins visibility and later override support.
insert into public.company_role_permissions (company_id, role, permission_key, is_allowed, source)
select c.id, matrix.role, matrix.permission_key, matrix.is_allowed, 'system_default'
from public.companies c
cross join (values
  ('company_admin', 'company.manage', true),
  ('company_admin', 'team.manage', true),
  ('company_admin', 'staff.manage', true),
  ('company_admin', 'resource.manage', true),
  ('company_admin', 'entity.manage', true),
  ('company_admin', 'entity_type.manage', true),
  ('company_admin', 'invite.manage', true),
  ('company_admin', 'permission.manage', true),
  ('company_admin', 'planning.manage', true),
  ('company_admin', 'audit.view', true),
  ('operations_manager', 'company.manage', true),
  ('operations_manager', 'team.manage', true),
  ('operations_manager', 'staff.manage', true),
  ('operations_manager', 'resource.manage', true),
  ('operations_manager', 'entity.manage', true),
  ('operations_manager', 'entity_type.manage', true),
  ('operations_manager', 'invite.manage', true),
  ('operations_manager', 'permission.manage', true),
  ('operations_manager', 'planning.manage', true),
  ('operations_manager', 'audit.view', true),
  ('planner', 'entity.manage', true),
  ('planner', 'planning.manage', true),
  ('supervisor', 'team.manage', true),
  ('supervisor', 'staff.manage', true),
  ('supervisor', 'resource.manage', true),
  ('dispatcher', 'planning.manage', true),
  ('team_lead', 'staff.manage', false),
  ('staff', 'entity.manage', false),
  ('contractor', 'entity.manage', false),
  ('read_only', 'audit.view', false)
) as matrix(role, permission_key, is_allowed)
on conflict (company_id, role, permission_key) do nothing;
