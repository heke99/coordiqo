-- Coordiqo Batch 8F hotfix
-- Säker reparations-SQL för resursmodulen om 8F kördes delvis eller om kolumner/tabeller saknas.
-- Branschneutral resursmotor: resurskrav, planerat ansvar, mobil kvittens, avvikelse och historik.

create extension if not exists pgcrypto;

-- Batch 8F bygger vidare på Batch 3-resurserna och skapar inte en parallell resursmodul.
alter table public.resource_assets add column if not exists allow_overlapping boolean not null default false;
alter table public.resource_assets add column if not exists requires_return boolean not null default true;

-- Standardtyper per företag. Company admin kan fortfarande skapa egna typer i UI.
insert into public.resource_types (company_id, code, name, description, is_active)
select c.id, seed.code, seed.name, seed.description, true
from public.companies c
cross join (values
  ('key', 'Nyckel', 'Nycklar, nyckelknippor och nyckelskåpsresurser.'),
  ('vehicle', 'Bil', 'Bilar, servicebilar och andra fordon.'),
  ('bike', 'Cykel', 'Cyklar och elcyklar.'),
  ('tool', 'Verktyg', 'Handverktyg, borrmaskiner och verktygsväskor.'),
  ('machine', 'Maskin', 'Maskiner, liftar och större utrustning.'),
  ('equipment', 'Utrustning', 'Allmän utrustning och hjälpmedel.'),
  ('access_card', 'Passerkort', 'Passerkort, taggar och behörighetskort.'),
  ('material', 'Material', 'Materialpaket, reservdelar och förbrukningsmaterial.'),
  ('medical_equipment', 'Medicinsk utrustning', 'Medicinsk utrustning och vårdhjälpmedel.'),
  ('other', 'Annat', 'Egen eller branschspecifik resurstyp.')
) as seed(code, name, description)
on conflict (company_id, code) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = timezone('utc', now());

create table if not exists public.resource_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  resource_asset_id uuid references public.resource_assets(id) on delete set null,
  resource_type_id uuid references public.resource_types(id) on delete set null,
  requirement_label text,
  quantity int not null default 1,
  is_hard_requirement boolean not null default true,
  allow_substitution boolean not null default true,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.planning_resource_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planning_run_id uuid references public.planning_runs(id) on delete set null,
  planning_draft_id uuid references public.planning_drafts(id) on delete set null,
  planning_draft_item_id uuid references public.planning_draft_items(id) on delete set null,
  task_assignment_id uuid references public.task_assignments(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  project_work_item_id uuid references public.project_work_items(id) on delete set null,
  resource_requirement_id uuid references public.resource_requirements(id) on delete set null,
  resource_asset_id uuid references public.resource_assets(id) on delete set null,
  actual_resource_asset_id uuid references public.resource_assets(id) on delete set null,
  resource_type_id uuid references public.resource_types(id) on delete set null,
  planned_staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  planned_team_id uuid references public.teams(id) on delete set null,
  shift_id uuid references public.shifts(id) on delete set null,
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  assignment_kind text not null default 'planned',
  status text not null default 'planned',
  picked_up_at timestamptz,
  returned_at timestamptz,
  last_event_at timestamptz,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.resource_usage_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  resource_assignment_id uuid references public.planning_resource_assignments(id) on delete set null,
  resource_asset_id uuid references public.resource_assets(id) on delete set null,
  actual_resource_asset_id uuid references public.resource_assets(id) on delete set null,
  replacement_resource_asset_id uuid references public.resource_assets(id) on delete set null,
  event_type text not null,
  performed_by_user_id uuid references public.profiles(id) on delete set null,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  event_at timestamptz not null default timezone('utc', now()),
  reason_code text,
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz
);

create table if not exists public.resource_deviations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  resource_assignment_id uuid references public.planning_resource_assignments(id) on delete set null,
  resource_asset_id uuid references public.resource_assets(id) on delete set null,
  replacement_resource_asset_id uuid references public.resource_assets(id) on delete set null,
  reported_by_user_id uuid references public.profiles(id) on delete set null,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  deviation_type text not null,
  description text,
  status text not null default 'open',
  resolution_note text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

-- Idempotenta constraints. Namnen är Batch 8F-specifika så de inte krockar med auto-namn.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'resource_requirements_8f_owner_type_check') then
    alter table public.resource_requirements add constraint resource_requirements_8f_owner_type_check
      check (owner_type in ('entity', 'task', 'project', 'project_work_item', 'planning_draft_item', 'manual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'resource_requirements_8f_quantity_check') then
    alter table public.resource_requirements add constraint resource_requirements_8f_quantity_check
      check (quantity >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'resource_requirements_8f_target_check') then
    alter table public.resource_requirements add constraint resource_requirements_8f_target_check
      check (resource_asset_id is not null or resource_type_id is not null or nullif(trim(coalesce(requirement_label, '')), '') is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'planning_resource_assignments_8f_kind_check') then
    alter table public.planning_resource_assignments add constraint planning_resource_assignments_8f_kind_check
      check (assignment_kind in ('planned', 'manual', 'extra', 'replacement', 'template', 'ai_suggestion'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'planning_resource_assignments_8f_status_check') then
    alter table public.planning_resource_assignments add constraint planning_resource_assignments_8f_status_check
      check (status in ('planned', 'picked_up', 'not_picked_up', 'replaced', 'extra_added', 'returned', 'issue_reported', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'planning_resource_assignments_8f_time_order_check') then
    alter table public.planning_resource_assignments add constraint planning_resource_assignments_8f_time_order_check
      check (planned_start_at is null or planned_end_at is null or planned_start_at < planned_end_at);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'resource_usage_events_8f_event_type_check') then
    alter table public.resource_usage_events add constraint resource_usage_events_8f_event_type_check
      check (event_type in ('planned', 'picked_up', 'not_picked_up', 'replaced', 'extra_added', 'returned', 'issue_reported', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'resource_deviations_8f_status_check') then
    alter table public.resource_deviations add constraint resource_deviations_8f_status_check
      check (status in ('open', 'reviewing', 'resolved', 'ignored'));
  end if;
end $$;

create index if not exists idx_resource_requirements_company_owner_active
  on public.resource_requirements(company_id, owner_type, owner_id)
  where archived_at is null;

create index if not exists idx_resource_requirements_company_asset_active
  on public.resource_requirements(company_id, resource_asset_id)
  where archived_at is null and resource_asset_id is not null;

create index if not exists idx_resource_requirements_company_type_active
  on public.resource_requirements(company_id, resource_type_id)
  where archived_at is null and resource_type_id is not null;

create index if not exists idx_planning_resource_assignments_company_draft_item_active
  on public.planning_resource_assignments(company_id, planning_draft_item_id)
  where archived_at is null;

create index if not exists idx_planning_resource_assignments_company_assignment_active
  on public.planning_resource_assignments(company_id, task_assignment_id)
  where archived_at is null;

create index if not exists idx_planning_resource_assignments_company_staff_time_active
  on public.planning_resource_assignments(company_id, planned_staff_profile_id, planned_start_at, planned_end_at)
  where archived_at is null;

create index if not exists idx_planning_resource_assignments_company_resource_time_active
  on public.planning_resource_assignments(company_id, resource_asset_id, planned_start_at, planned_end_at)
  where archived_at is null;

create index if not exists idx_planning_resource_assignments_company_actual_resource_active
  on public.planning_resource_assignments(company_id, actual_resource_asset_id, planned_start_at, planned_end_at)
  where archived_at is null and actual_resource_asset_id is not null;

create index if not exists idx_resource_usage_events_company_assignment_time
  on public.resource_usage_events(company_id, resource_assignment_id, event_at desc);

create index if not exists idx_resource_usage_events_company_resource_time
  on public.resource_usage_events(company_id, resource_asset_id, event_at desc);

create index if not exists idx_resource_deviations_company_status_active
  on public.resource_deviations(company_id, status, created_at desc)
  where archived_at is null;

create index if not exists idx_resource_assets_company_status_active
  on public.resource_assets(company_id, status)
  where archived_at is null;

-- Updated-at triggers.
drop trigger if exists trg_resource_requirements_updated_at on public.resource_requirements;
create trigger trg_resource_requirements_updated_at before update on public.resource_requirements
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_planning_resource_assignments_updated_at on public.planning_resource_assignments;
create trigger trg_planning_resource_assignments_updated_at before update on public.planning_resource_assignments
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_resource_deviations_updated_at on public.resource_deviations;
create trigger trg_resource_deviations_updated_at before update on public.resource_deviations
for each row execute procedure public.set_updated_at();

-- RLS.
alter table public.resource_requirements enable row level security;
alter table public.planning_resource_assignments enable row level security;
alter table public.resource_usage_events enable row level security;
alter table public.resource_deviations enable row level security;

drop policy if exists "resource requirements visible to company members" on public.resource_requirements;
create policy "resource requirements visible to company members"
on public.resource_requirements for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "resource requirements managed by planners" on public.resource_requirements;
create policy "resource requirements managed by planners"
on public.resource_requirements for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'planner'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

drop policy if exists "resource responsibilities visible to company members" on public.planning_resource_assignments;
create policy "resource responsibilities visible to company members"
on public.planning_resource_assignments for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "resource responsibilities managed by staff" on public.planning_resource_assignments;
create policy "resource responsibilities managed by staff"
on public.planning_resource_assignments for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'staff'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'staff'));

drop policy if exists "resource usage events visible to company members" on public.resource_usage_events;
create policy "resource usage events visible to company members"
on public.resource_usage_events for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "resource usage events managed by staff" on public.resource_usage_events;
create policy "resource usage events managed by staff"
on public.resource_usage_events for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'staff'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'staff'));

drop policy if exists "resource deviations visible to company members" on public.resource_deviations;
create policy "resource deviations visible to company members"
on public.resource_deviations for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "resource deviations managed by staff" on public.resource_deviations;
create policy "resource deviations managed by staff"
on public.resource_deviations for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'staff'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'staff'));

-- Modulmarkering.
insert into public.platform_modules (code, name, description, is_core, sort_order)
values ('resource_responsibility', 'Resursansvar', 'Branschneutral resursmotor för krav, planerat ansvar, mobil kvittens, avvikelse och historik.', true, 95)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_core = excluded.is_core,
    sort_order = excluded.sort_order,
    updated_at = timezone('utc', now());

insert into public.company_modules (company_id, module_code, status, enabled_at, settings)
select c.id, 'resource_responsibility', 'active', timezone('utc', now()), '{}'::jsonb
from public.companies c
on conflict (company_id, module_code) do update
set status = excluded.status,
    enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at),
    updated_at = timezone('utc', now());

update public.company_settings
set active_modules = array(
      select distinct unnest(coalesce(active_modules, '{}'::text[]) || array['resource_responsibility'])
    ),
    updated_at = timezone('utc', now());
