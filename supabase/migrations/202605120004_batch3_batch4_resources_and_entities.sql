-- Coordiqo Batch 3 + Batch 4
-- Staff, resources, organisation hardening and dynamic entities.

create extension if not exists pgcrypto;

-- Soft delete / archiving foundations on existing core tables.
alter table public.teams add column if not exists archived_at timestamptz;
alter table public.entity_types add column if not exists archived_at timestamptz;
alter table public.company_memberships add column if not exists archived_at timestamptz;
alter table public.audit_logs add column if not exists ip_address text;
alter table public.audit_logs add column if not exists user_agent text;

create index if not exists idx_teams_company_active_not_archived
  on public.teams(company_id, status)
  where archived_at is null;

create index if not exists idx_entity_types_company_active_not_archived
  on public.entity_types(company_id, is_active)
  where archived_at is null;

-- Generic audit helper. Server/service role can still insert directly, but this keeps SQL flows consistent.
create or replace function public.write_audit_log(
  p_company_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_company_id, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.write_audit_log(uuid, text, text, text, jsonb) to authenticated;

-- Staff / people who can perform operational work.
create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  membership_id uuid references public.company_memberships(id) on delete set null,
  primary_team_id uuid references public.teams(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  employee_id text,
  job_title text,
  staff_kind text not null default 'staff' check (staff_kind in ('staff', 'contractor', 'manager', 'planner', 'supervisor', 'external')),
  employment_type text default 'unspecified' check (employment_type in ('full_time', 'part_time', 'hourly', 'contractor', 'temporary', 'unspecified')),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  transport_mode text not null default 'car' check (transport_mode in ('car', 'bike', 'walk', 'public_transport', 'service_vehicle', 'none')),
  start_address text,
  end_address text,
  max_hours_per_day numeric(5,2),
  max_travel_minutes_per_day int,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, employee_id)
);

create table if not exists public.staff_languages (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  language_code text not null,
  proficiency text default 'working' check (proficiency in ('basic', 'working', 'fluent', 'native')),
  created_at timestamptz not null default timezone('utc', now()),
  unique(staff_profile_id, language_code)
);

create table if not exists public.staff_licenses (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  license_type text not null,
  license_number text,
  valid_from date,
  valid_until date,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'archived')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.staff_status_history (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  old_status text,
  new_status text not null,
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Resource assets: vehicles, keys, tools, equipment.
create table if not exists public.resource_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, code)
);

create table if not exists public.resource_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  resource_type_id uuid references public.resource_types(id) on delete set null,
  assigned_staff_id uuid references public.staff_profiles(id) on delete set null,
  assigned_team_id uuid references public.teams(id) on delete set null,
  name text not null,
  asset_tag text,
  status text not null default 'available' check (status in ('available', 'assigned', 'maintenance', 'lost', 'inactive', 'archived')),
  location_label text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, asset_tag)
);

create table if not exists public.resource_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  resource_asset_id uuid not null references public.resource_assets(id) on delete cascade,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  assigned_from timestamptz not null default timezone('utc', now()),
  assigned_until timestamptz,
  status text not null default 'active' check (status in ('active', 'returned', 'cancelled')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Dynamic core entities for work targets: customer, patient, property, unit, zone, service point, project, etc.
create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type_id uuid not null references public.entity_types(id) on delete restrict,
  primary_team_id uuid references public.teams(id) on delete set null,
  name text not null,
  external_id text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  summary text,
  instructions text,
  sensitive_notes text,
  custom_fields jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, external_id)
);

create table if not exists public.entity_addresses (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  label text not null default 'Huvudadress',
  street text,
  postal_code text,
  city text,
  country_code text not null default 'SE',
  latitude numeric(10,7),
  longitude numeric(10,7),
  access_instructions text,
  is_primary boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.entity_contacts (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  name text not null,
  role_label text,
  email text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.entity_notes (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  note text not null,
  visibility text not null default 'internal' check (visibility in ('internal', 'staff', 'external')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.entity_documents (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  document_type text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.entity_status_history (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  old_status text,
  new_status text not null,
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.entity_relations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  parent_entity_id uuid not null references public.entities(id) on delete cascade,
  child_entity_id uuid not null references public.entities(id) on delete cascade,
  relation_type text not null default 'related',
  created_at timestamptz not null default timezone('utc', now()),
  unique(parent_entity_id, child_entity_id, relation_type)
);

-- Indexes for responsive list/search pages.
create index if not exists idx_staff_profiles_company_status on public.staff_profiles(company_id, status) where archived_at is null;
create index if not exists idx_staff_profiles_company_name on public.staff_profiles(company_id, lower(full_name));
create index if not exists idx_resource_assets_company_status on public.resource_assets(company_id, status) where archived_at is null;
create index if not exists idx_resource_assets_company_name on public.resource_assets(company_id, lower(name));
create index if not exists idx_entities_company_status on public.entities(company_id, status) where archived_at is null;
create index if not exists idx_entities_company_name on public.entities(company_id, lower(name));
create index if not exists idx_entities_company_type on public.entities(company_id, entity_type_id) where archived_at is null;
create index if not exists idx_entity_addresses_entity_primary on public.entity_addresses(entity_id, is_primary);

-- Updated-at triggers.
drop trigger if exists trg_staff_profiles_updated_at on public.staff_profiles;
create trigger trg_staff_profiles_updated_at before update on public.staff_profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_staff_licenses_updated_at on public.staff_licenses;
create trigger trg_staff_licenses_updated_at before update on public.staff_licenses
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_resource_types_updated_at on public.resource_types;
create trigger trg_resource_types_updated_at before update on public.resource_types
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_resource_assets_updated_at on public.resource_assets;
create trigger trg_resource_assets_updated_at before update on public.resource_assets
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_entities_updated_at on public.entities;
create trigger trg_entities_updated_at before update on public.entities
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_entity_addresses_updated_at on public.entity_addresses;
create trigger trg_entity_addresses_updated_at before update on public.entity_addresses
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_entity_contacts_updated_at on public.entity_contacts;
create trigger trg_entity_contacts_updated_at before update on public.entity_contacts
for each row execute procedure public.set_updated_at();

-- RLS.
alter table public.staff_profiles enable row level security;
alter table public.staff_languages enable row level security;
alter table public.staff_licenses enable row level security;
alter table public.staff_status_history enable row level security;
alter table public.resource_types enable row level security;
alter table public.resource_assets enable row level security;
alter table public.resource_assignments enable row level security;
alter table public.entities enable row level security;
alter table public.entity_addresses enable row level security;
alter table public.entity_contacts enable row level security;
alter table public.entity_notes enable row level security;
alter table public.entity_documents enable row level security;
alter table public.entity_status_history enable row level security;
alter table public.entity_relations enable row level security;

-- Staff policies.
drop policy if exists "staff visible to company members" on public.staff_profiles;
create policy "staff visible to company members"
on public.staff_profiles for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "staff managed by supervisors" on public.staff_profiles;
create policy "staff managed by supervisors"
on public.staff_profiles for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'supervisor'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'supervisor'));

-- Resource policies.
drop policy if exists "resource types visible to members" on public.resource_types;
create policy "resource types visible to members"
on public.resource_types for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "resource types managed by supervisors" on public.resource_types;
create policy "resource types managed by supervisors"
on public.resource_types for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'supervisor'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'supervisor'));

drop policy if exists "resources visible to members" on public.resource_assets;
create policy "resources visible to members"
on public.resource_assets for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "resources managed by supervisors" on public.resource_assets;
create policy "resources managed by supervisors"
on public.resource_assets for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'supervisor'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'supervisor'));

-- Entity policies.
drop policy if exists "entities visible to company members" on public.entities;
create policy "entities visible to company members"
on public.entities for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "entities managed by planners" on public.entities;
create policy "entities managed by planners"
on public.entities for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'planner'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

drop policy if exists "entity addresses visible to company members" on public.entity_addresses;
create policy "entity addresses visible to company members"
on public.entity_addresses for select
using (exists (select 1 from public.entities e where e.id = entity_id and (public.is_platform_admin() or public.is_company_member(e.company_id))));

drop policy if exists "entity addresses managed by planners" on public.entity_addresses;
create policy "entity addresses managed by planners"
on public.entity_addresses for all
using (exists (select 1 from public.entities e where e.id = entity_id and (public.is_platform_admin() or public.has_company_role(e.company_id, 'planner'))))
with check (exists (select 1 from public.entities e where e.id = entity_id and (public.is_platform_admin() or public.has_company_role(e.company_id, 'planner'))));

drop policy if exists "entity contacts visible to company members" on public.entity_contacts;
create policy "entity contacts visible to company members"
on public.entity_contacts for select
using (exists (select 1 from public.entities e where e.id = entity_id and (public.is_platform_admin() or public.is_company_member(e.company_id))));

drop policy if exists "entity contacts managed by planners" on public.entity_contacts;
create policy "entity contacts managed by planners"
on public.entity_contacts for all
using (exists (select 1 from public.entities e where e.id = entity_id and (public.is_platform_admin() or public.has_company_role(e.company_id, 'planner'))))
with check (exists (select 1 from public.entities e where e.id = entity_id and (public.is_platform_admin() or public.has_company_role(e.company_id, 'planner'))));

-- Notes/documents/status/relations are tenant-scoped via company_id.
drop policy if exists "entity notes visible to members" on public.entity_notes;
create policy "entity notes visible to members"
on public.entity_notes for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "entity notes managed by members" on public.entity_notes;
create policy "entity notes managed by members"
on public.entity_notes for all
using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "resource assignments visible to members" on public.resource_assignments;
create policy "resource assignments visible to members"
on public.resource_assignments for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "resource assignments managed by supervisors" on public.resource_assignments;
create policy "resource assignments managed by supervisors"
on public.resource_assignments for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'supervisor'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'supervisor'));

insert into public.platform_modules (code, name, description, is_core, sort_order)
values
  ('resources', 'Personal och resurser', 'Personalprofiler, fordon, utrustning och organisation.', false, 25)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

create or replace function public.ensure_company_industry_defaults(target_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_industry text;
  v_preset record;
begin
  select c.industry_type into v_industry
  from public.companies c
  where c.id = target_company_id;

  if target_company_id is null or v_industry is null then
    return;
  end if;

  insert into public.company_modules (company_id, module_code, status, enabled_at)
  values
    (target_company_id, 'foundation', 'active', timezone('utc', now())),
    (target_company_id, 'industry_engine', 'active', timezone('utc', now())),
    (target_company_id, 'resources', 'active', timezone('utc', now())),
    (target_company_id, 'entities', 'active', timezone('utc', now())),
    (target_company_id, 'tasks', 'planned', null),
    (target_company_id, 'planning', 'planned', null),
    (target_company_id, 'mobile_staff', 'planned', null)
  on conflict (company_id, module_code) do update set
    status = excluded.status,
    enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at),
    updated_at = timezone('utc', now());

  update public.company_settings
  set active_modules = array(
    select distinct unnest(coalesce(active_modules, '{}'::text[]) || array['foundation', 'industry_engine', 'resources', 'entities'])
  ),
  updated_at = timezone('utc', now())
  where company_id = target_company_id;

  for v_preset in
    select *
    from public.industry_entity_presets
    where industry_code = v_industry
      and is_active = true
    order by sort_order asc
  loop
    insert into public.entity_types (
      company_id, code, label_singular, label_plural, description, source, source_preset_id, is_active, sort_order
    )
    values (
      target_company_id, v_preset.entity_code, v_preset.label_singular, v_preset.label_plural,
      v_preset.description, 'industry_preset', v_preset.id, true, v_preset.sort_order
    )
    on conflict (company_id, code) do nothing;
  end loop;
end;
$$;

drop policy if exists "staff languages visible to members" on public.staff_languages;
create policy "staff languages visible to members"
on public.staff_languages for select
using (exists (select 1 from public.staff_profiles sp where sp.id = staff_profile_id and (public.is_platform_admin() or public.is_company_member(sp.company_id))));

drop policy if exists "staff languages managed by supervisors" on public.staff_languages;
create policy "staff languages managed by supervisors"
on public.staff_languages for all
using (exists (select 1 from public.staff_profiles sp where sp.id = staff_profile_id and (public.is_platform_admin() or public.has_company_role(sp.company_id, 'supervisor'))))
with check (exists (select 1 from public.staff_profiles sp where sp.id = staff_profile_id and (public.is_platform_admin() or public.has_company_role(sp.company_id, 'supervisor'))));

drop policy if exists "staff licenses visible to members" on public.staff_licenses;
create policy "staff licenses visible to members"
on public.staff_licenses for select
using (exists (select 1 from public.staff_profiles sp where sp.id = staff_profile_id and (public.is_platform_admin() or public.is_company_member(sp.company_id))));

drop policy if exists "staff licenses managed by supervisors" on public.staff_licenses;
create policy "staff licenses managed by supervisors"
on public.staff_licenses for all
using (exists (select 1 from public.staff_profiles sp where sp.id = staff_profile_id and (public.is_platform_admin() or public.has_company_role(sp.company_id, 'supervisor'))))
with check (exists (select 1 from public.staff_profiles sp where sp.id = staff_profile_id and (public.is_platform_admin() or public.has_company_role(sp.company_id, 'supervisor'))));

drop policy if exists "entity documents visible to members" on public.entity_documents;
create policy "entity documents visible to members"
on public.entity_documents for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "entity documents managed by planners" on public.entity_documents;
create policy "entity documents managed by planners"
on public.entity_documents for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'planner'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

drop policy if exists "entity status history visible to members" on public.entity_status_history;
create policy "entity status history visible to members"
on public.entity_status_history for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "entity relations visible to members" on public.entity_relations;
create policy "entity relations visible to members"
on public.entity_relations for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "entity relations managed by planners" on public.entity_relations;
create policy "entity relations managed by planners"
on public.entity_relations for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'planner'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

-- Seed default resource types for existing companies.
insert into public.resource_types (company_id, code, name, description)
select c.id, v.code, v.name, v.description
from public.companies c
cross join (values
  ('vehicle', 'Fordon', 'Bilar, servicebilar, cyklar och andra färdsätt.'),
  ('equipment', 'Utrustning', 'Verktyg, scanners, maskiner och specialutrustning.'),
  ('access', 'Nyckel/tagg', 'Nycklar, accesskort, taggar och behörigheter.'),
  ('safety', 'Skyddsutrustning', 'Skyddskläder, säkerhetsutrustning och arbetsmiljöresurser.')
) as v(code, name, description)
on conflict (company_id, code) do nothing;

-- Activate modules for existing companies.
insert into public.company_modules (company_id, module_code, status, enabled_at)
select c.id, v.module_code, 'active', timezone('utc', now())
from public.companies c
cross join (values ('entities'), ('tasks')) as v(module_code)
on conflict (company_id, module_code) do update set
  status = excluded.status,
  enabled_at = coalesce(public.company_modules.enabled_at, timezone('utc', now())),
  updated_at = timezone('utc', now());

insert into public.company_modules (company_id, module_code, status, enabled_at)
select c.id, 'resources', 'active', timezone('utc', now())
from public.companies c
on conflict (company_id, module_code) do update set
  status = excluded.status,
  enabled_at = coalesce(public.company_modules.enabled_at, timezone('utc', now())),
  updated_at = timezone('utc', now());

update public.company_settings
set active_modules = array(
  select distinct unnest(coalesce(active_modules, '{}'::text[]) || array['resources', 'entities'])
),
updated_at = timezone('utc', now())
where true;
