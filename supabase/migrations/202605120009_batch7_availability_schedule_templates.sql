-- Batch 7 — Availability, schedule, absences and availability templates

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  title text,
  shift_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'planned',
  role_label text,
  transport_mode text not null default 'car',
  start_location_type text not null default 'company_base',
  start_entity_id uuid references public.entities(id) on delete set null,
  start_address_text text,
  start_lat numeric,
  start_lng numeric,
  end_location_type text not null default 'company_base',
  end_entity_id uuid references public.entities(id) on delete set null,
  end_address_text text,
  end_lat numeric,
  end_lng numeric,
  total_minutes integer not null default 0,
  break_minutes integer not null default 0,
  buffer_minutes integer not null default 0,
  capacity_minutes integer not null default 0,
  planned_minutes integer not null default 0,
  remaining_minutes integer not null default 0,
  planning_locked boolean not null default false,
  locked_fields jsonb not null default '[]'::jsonb,
  locked_reason text,
  locked_by uuid references public.profiles(id) on delete set null,
  locked_at timestamptz,
  source text not null default 'manual',
  source_template_id uuid,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint shifts_time_order check (ends_at > starts_at)
);

create table if not exists public.shift_breaks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  name text not null default 'Rast',
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer not null default 30,
  is_paid boolean not null default false,
  is_flexible boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.absence_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  affects_planning boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, code)
);

create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  absence_type_id uuid references public.absence_types(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_all_day boolean not null default false,
  status text not null default 'approved',
  affects_planning boolean not null default true,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint absences_time_order check (ends_at > starts_at)
);

create table if not exists public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  staff_profile_id uuid references public.staff_profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  block_type text not null default 'unavailable',
  rule_type text not null default 'time',
  affects_planning boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint availability_blocks_target_check check (staff_profile_id is not null or team_id is not null),
  constraint availability_blocks_time_order check (ends_at > starts_at)
);

create table if not exists public.availability_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  target_type text not null default 'staff',
  industry_code text,
  status text not null default 'active',
  valid_from date,
  valid_to date,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.availability_template_targets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null references public.availability_templates(id) on delete cascade,
  target_type text not null,
  staff_profile_id uuid references public.staff_profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint availability_template_targets_target_check check (staff_profile_id is not null or team_id is not null)
);

create table if not exists public.availability_template_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null references public.availability_templates(id) on delete cascade,
  weekday integer not null check (weekday between 1 and 7),
  title text,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0,
  buffer_minutes integer not null default 0,
  capacity_minutes integer,
  role_label text,
  transport_mode text not null default 'car',
  start_location_type text not null default 'company_base',
  start_address_text text,
  end_location_type text not null default 'company_base',
  end_address_text text,
  min_staff integer,
  max_staff integer,
  required_skill_id uuid references public.skills(id) on delete set null,
  required_certification_id uuid references public.certifications(id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint availability_template_items_time_order check (end_time > start_time)
);

create table if not exists public.availability_template_applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null references public.availability_templates(id) on delete cascade,
  applied_from date not null,
  applied_to date not null,
  target_summary jsonb not null default '{}'::jsonb,
  created_shift_ids uuid[] not null default '{}',
  skipped_count integer not null default 0,
  conflict_count integer not null default 0,
  status text not null default 'completed',
  applied_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.team_staffing_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  requirement_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  min_staff integer not null default 1,
  max_staff integer,
  required_role text,
  required_skill_id uuid references public.skills(id) on delete set null,
  required_certification_id uuid references public.certifications(id) on delete set null,
  required_transport_mode text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.continuity_preferences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  staff_profile_id uuid references public.staff_profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  preference_type text not null default 'prefer',
  weight integer not null default 50,
  reason text,
  valid_from date,
  valid_to date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint continuity_preferences_target_check check (staff_profile_id is not null or team_id is not null)
);

create table if not exists public.availability_conflicts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conflict_type text not null,
  severity text not null default 'warning',
  status text not null default 'open',
  staff_profile_id uuid references public.staff_profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete cascade,
  absence_id uuid references public.absences(id) on delete cascade,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create index if not exists idx_shifts_company_date on public.shifts(company_id, shift_date);
create index if not exists idx_shifts_staff_date on public.shifts(staff_profile_id, shift_date) where archived_at is null;
create index if not exists idx_absences_staff_time on public.absences(staff_profile_id, starts_at, ends_at) where archived_at is null;
create index if not exists idx_availability_blocks_staff_time on public.availability_blocks(staff_profile_id, starts_at, ends_at) where archived_at is null;
create index if not exists idx_availability_templates_company on public.availability_templates(company_id, target_type) where archived_at is null;

create unique index if not exists idx_shifts_template_dedupe
on public.shifts(company_id, staff_profile_id, team_id, shift_date, starts_at, ends_at, source_template_id)
where source_template_id is not null and archived_at is null;

-- Add module marker without assuming company_modules.config exists.
insert into public.platform_modules (code, name, description, is_core, sort_order)
values ('availability_engine', 'Tillgänglighet och schema', 'Pass, frånvaro, kapacitet och tillgänglighetsmallar.', true, 70)
on conflict (code) do update set name = excluded.name, description = excluded.description, is_core = excluded.is_core, sort_order = excluded.sort_order;

insert into public.company_modules (company_id, module_code, status, enabled_at, settings)
select c.id, 'availability_engine', 'active', timezone('utc', now()), '{}'::jsonb
from public.companies c
on conflict (company_id, module_code) do update set status = 'active', enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at);

insert into public.absence_types (company_id, code, name, affects_planning)
select c.id, v.code, v.name, v.affects_planning
from public.companies c
cross join (values
  ('sick', 'Sjuk', true),
  ('vacation', 'Semester', true),
  ('vab', 'VAB', true),
  ('training', 'Utbildning', true),
  ('leave', 'Ledig', true),
  ('meeting', 'Möte', true),
  ('blocked', 'Blockering', true),
  ('other', 'Annat', true)
) as v(code, name, affects_planning)
on conflict (company_id, code) do update set name = excluded.name, affects_planning = excluded.affects_planning, is_active = true, archived_at = null;

-- Updated-at triggers

do $$
declare t text;
begin
  foreach t in array array['shifts','shift_breaks','absence_types','absences','availability_blocks','availability_templates','availability_template_items','team_staffing_requirements','continuity_preferences'] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', t, t);
  end loop;
end $$;

-- RLS
alter table public.shifts enable row level security;
alter table public.shift_breaks enable row level security;
alter table public.absence_types enable row level security;
alter table public.absences enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.availability_templates enable row level security;
alter table public.availability_template_targets enable row level security;
alter table public.availability_template_items enable row level security;
alter table public.availability_template_applications enable row level security;
alter table public.team_staffing_requirements enable row level security;
alter table public.continuity_preferences enable row level security;
alter table public.availability_conflicts enable row level security;

-- Policies, idempotent via do blocks.
do $$ begin
  create policy "shifts visible to company members" on public.shifts for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "shifts managed by planners" on public.shifts for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "shift breaks visible to company members" on public.shift_breaks for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "shift breaks managed by planners" on public.shift_breaks for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "absence types visible to company members" on public.absence_types for select using (company_id is null or public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "absence types managed by planners" on public.absence_types for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "absences visible to company members" on public.absences for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "absences managed by planners" on public.absences for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "availability blocks visible to company members" on public.availability_blocks for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "availability blocks managed by planners" on public.availability_blocks for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "availability templates visible to company members" on public.availability_templates for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "availability templates managed by planners" on public.availability_templates for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "availability template children visible to company members" on public.availability_template_targets for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "availability template children managed by planners" on public.availability_template_targets for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "availability template items visible to company members" on public.availability_template_items for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "availability template items managed by planners" on public.availability_template_items for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "availability template applications visible to company members" on public.availability_template_applications for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "availability template applications managed by planners" on public.availability_template_applications for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "team staffing requirements visible to members" on public.team_staffing_requirements for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "team staffing requirements managed by planners" on public.team_staffing_requirements for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "continuity preferences visible to members" on public.continuity_preferences for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "continuity preferences managed by planners" on public.continuity_preferences for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "availability conflicts visible to members" on public.availability_conflicts for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "availability conflicts managed by planners" on public.availability_conflicts for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));
exception when duplicate_object then null; end $$;
