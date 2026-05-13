-- Coordiqo Batch 8C + 8D
-- 8C: reusable planning templates and template applications.
-- 8D: project planning foundation with DB-driven estimation rules and project-generated tasks.

create extension if not exists pgcrypto;

-- Batch 8C — reusable planning templates.
create table if not exists public.planning_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  template_type text not null default 'operational' check (template_type in ('operational', 'route', 'project', 'care', 'cleaning', 'property', 'custom')),
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'archived')),
  industry_type text,
  operational_model text,
  default_date_span_days integer not null default 1 check (default_date_span_days > 0),
  default_start_time time,
  default_team_id uuid references public.teams(id) on delete set null,
  default_staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  source_planning_draft_id uuid references public.planning_drafts(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, name)
);

create table if not exists public.planning_template_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planning_template_id uuid not null references public.planning_templates(id) on delete cascade,
  source_planning_draft_item_id uuid references public.planning_draft_items(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  task_type_id uuid references public.task_types(id) on delete set null,
  entity_id uuid references public.entities(id) on delete set null,
  title text not null,
  description text,
  instructions text,
  priority text not null default 'normal',
  offset_days integer not null default 0 check (offset_days >= 0),
  start_time time,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  shift_id uuid references public.shifts(id) on delete set null,
  continuity_key text,
  is_required boolean not null default true,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.planning_template_applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planning_template_id uuid not null references public.planning_templates(id) on delete cascade,
  planning_run_id uuid references public.planning_runs(id) on delete set null,
  planning_draft_id uuid references public.planning_drafts(id) on delete set null,
  applied_date_from date not null,
  applied_date_to date not null,
  status text not null default 'completed' check (status in ('completed', 'partial', 'failed', 'cancelled')),
  created_draft_item_ids uuid[] not null default '{}'::uuid[],
  skipped_count integer not null default 0,
  conflict_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  applied_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint planning_template_applications_date_order check (applied_date_to >= applied_date_from)
);

-- Batch 8D — project planning and DB-owned estimation rules.
create table if not exists public.project_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  scope text not null default 'company' check (scope in ('system', 'company')),
  industry_type text,
  project_type text not null default 'custom',
  name text not null,
  description text,
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'archived')),
  default_phase_model jsonb not null default '[]'::jsonb,
  intake_schema jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint project_templates_company_scope_match_check check ((scope = 'system' and company_id is null) or (scope = 'company' and company_id is not null))
);

create unique index if not exists project_templates_system_unique_idx
on public.project_templates(scope, coalesce(industry_type, 'generic'), lower(name))
where scope = 'system' and archived_at is null;

create unique index if not exists project_templates_company_unique_idx
on public.project_templates(company_id, lower(name))
where scope = 'company' and archived_at is null;

create table if not exists public.project_template_questions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  project_template_id uuid not null references public.project_templates(id) on delete cascade,
  question_key text not null,
  label text not null,
  help_text text,
  input_type text not null default 'text' check (input_type in ('text', 'textarea', 'number', 'select', 'multi_select', 'date', 'boolean')),
  unit_label text,
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  default_value text,
  sort_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(project_template_id, question_key)
);

create table if not exists public.project_estimation_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  project_template_id uuid references public.project_templates(id) on delete cascade,
  scope text not null default 'company' check (scope in ('system', 'company')),
  industry_type text,
  rule_key text not null,
  phase_key text not null default 'general',
  work_item_title text not null,
  driver_key text not null default 'fixed',
  quantity_source text not null default 'fixed' check (quantity_source in ('fixed', 'square_meters', 'rooms', 'windows', 'doors', 'workers', 'custom_number')),
  quantity_multiplier numeric not null default 1,
  minutes_per_unit numeric not null default 60,
  minimum_minutes integer not null default 0,
  material_cost_per_unit numeric not null default 0,
  fixed_cost numeric not null default 0,
  applies_when jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_template_id uuid references public.project_templates(id) on delete set null,
  entity_id uuid references public.entities(id) on delete set null,
  project_code text,
  name text not null,
  description text,
  project_type text not null default 'custom',
  status text not null default 'draft' check (status in ('draft', 'estimating', 'planned', 'active', 'paused', 'completed', 'cancelled', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  target_start_date date,
  target_end_date date,
  deadline_date date,
  default_team_id uuid references public.teams(id) on delete set null,
  default_staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  planned_workers integer not null default 1 check (planned_workers > 0),
  estimated_effort_minutes integer not null default 0,
  estimated_calendar_minutes integer not null default 0,
  estimated_labor_cost numeric not null default 0,
  estimated_material_cost numeric not null default 0,
  estimated_total_cost numeric not null default 0,
  budget_amount numeric,
  currency text not null default 'SEK',
  intake_summary jsonb not null default '{}'::jsonb,
  calculation_summary jsonb not null default '{}'::jsonb,
  ai_assist_status text not null default 'not_used' check (ai_assist_status in ('not_used', 'suggested', 'accepted', 'rejected')),
  ai_assist_summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, project_code)
);

create table if not exists public.project_intake_answers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  project_template_question_id uuid references public.project_template_questions(id) on delete set null,
  question_key text not null,
  answer_text text,
  answer_number numeric,
  answer_boolean boolean,
  answer_json jsonb not null default '{}'::jsonb,
  source text not null default 'manual' check (source in ('manual', 'import', 'ai_suggestion')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_phases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_key text not null,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'planned', 'active', 'completed', 'cancelled', 'archived')),
  sort_order integer not null default 100,
  planned_start_date date,
  planned_end_date date,
  estimated_effort_minutes integer not null default 0,
  estimated_calendar_minutes integer not null default 0,
  estimated_cost numeric not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(project_id, phase_key)
);

create table if not exists public.project_work_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  project_phase_id uuid references public.project_phases(id) on delete cascade,
  source_estimation_rule_id uuid references public.project_estimation_rules(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'planned', 'scheduled', 'active', 'completed', 'cancelled', 'archived')),
  quantity numeric not null default 1,
  unit_label text,
  estimated_effort_minutes integer not null default 0,
  estimated_calendar_minutes integer not null default 0,
  estimated_material_cost numeric not null default 0,
  estimated_total_cost numeric not null default 0,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

alter table public.tasks add column if not exists project_id uuid;
alter table public.tasks add column if not exists project_phase_id uuid;
alter table public.tasks add column if not exists project_work_item_id uuid;
alter table public.tasks add column if not exists source_type text not null default 'manual';
alter table public.tasks add column if not exists source_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_project_fk' and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_project_fk foreign key (project_id) references public.projects(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_project_phase_fk' and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_project_phase_fk foreign key (project_phase_id) references public.project_phases(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_project_work_item_fk' and conrelid = 'public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_project_work_item_fk foreign key (project_work_item_id) references public.project_work_items(id) on delete set null;
  end if;
end $$;

-- Connect Batch 8A/8B planning rows to Batch 8D projects without forcing project deletion to remove history.
do $$
declare
  target_table text;
begin
  foreach target_table in array array['planning_runs', 'planning_drafts', 'planning_draft_items', 'task_assignments', 'assignment_candidates', 'planning_conflicts']
  loop
    if not exists (select 1 from pg_constraint where conname = target_table || '_project_fk') then
      execute format('alter table public.%I add constraint %I foreign key (project_id) references public.projects(id) on delete set null', target_table, target_table || '_project_fk');
    end if;
    if not exists (select 1 from pg_constraint where conname = target_table || '_project_phase_fk') then
      execute format('alter table public.%I add constraint %I foreign key (project_phase_id) references public.project_phases(id) on delete set null', target_table, target_table || '_project_phase_fk');
    end if;
    if not exists (select 1 from pg_constraint where conname = target_table || '_project_work_item_fk') then
      execute format('alter table public.%I add constraint %I foreign key (project_work_item_id) references public.project_work_items(id) on delete set null', target_table, target_table || '_project_work_item_fk');
    end if;
  end loop;
end $$;

create index if not exists idx_planning_templates_company on public.planning_templates(company_id, status) where archived_at is null;
create index if not exists idx_planning_template_items_template on public.planning_template_items(planning_template_id, sort_order) where archived_at is null;
create index if not exists idx_planning_template_applications_template on public.planning_template_applications(planning_template_id, created_at desc);
create index if not exists idx_project_templates_visible on public.project_templates(scope, company_id, industry_type) where archived_at is null;
create index if not exists idx_project_estimation_rules_template on public.project_estimation_rules(project_template_id, phase_key) where archived_at is null;
create unique index if not exists project_estimation_rules_template_rule_unique_idx
on public.project_estimation_rules(scope, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(project_template_id, '00000000-0000-0000-0000-000000000000'::uuid), rule_key)
where archived_at is null;
create index if not exists idx_projects_company_status on public.projects(company_id, status, created_at desc) where archived_at is null;
create index if not exists idx_project_phases_project on public.project_phases(project_id, sort_order) where archived_at is null;
create index if not exists idx_project_work_items_project on public.project_work_items(project_id, sort_order) where archived_at is null;
create index if not exists idx_tasks_project on public.tasks(company_id, project_id, status) where archived_at is null;

-- System project templates and rules. These are presets; companies can create their own and override the assumptions.
with renovation_template as (
  insert into public.project_templates (scope, company_id, industry_type, project_type, name, description, default_phase_model, intake_schema, assumptions)
  values (
    'system', null, 'property', 'property_renovation', 'Fastighetsrenovering', 'Preset för renoveringsprojekt: yta, rum, fönster, omfattning, personal och preliminär kostnad/tid.',
    '[{"key":"planning","name":"Planering"},{"key":"demolition","name":"Rivning/förarbete"},{"key":"build","name":"Utförande"},{"key":"finish","name":"Slutkontroll"}]'::jsonb,
    '[{"key":"square_meters","label":"Antal kvm","type":"number","required":true},{"key":"rooms","label":"Antal rum","type":"number","required":false},{"key":"windows","label":"Antal fönster","type":"number","required":false},{"key":"scope","label":"Omfattning","type":"select","options":["hela","delar","rum","fönster"]},{"key":"planned_workers","label":"Antal personal","type":"number","required":true}]'::jsonb,
    '{"labor_rate_per_hour":550,"currency":"SEK","source":"system_preset"}'::jsonb
  )
  on conflict do nothing
  returning id
), generic_template as (
  insert into public.project_templates (scope, company_id, industry_type, project_type, name, description, default_phase_model, intake_schema, assumptions)
  values (
    'system', null, null, 'operations_project', 'Operativt projekt', 'Generisk projektmall för uppdrag som ska brytas ned till arbetsmoment och planeras.',
    '[{"key":"planning","name":"Planering"},{"key":"execution","name":"Utförande"},{"key":"followup","name":"Uppföljning"}]'::jsonb,
    '[{"key":"estimated_hours","label":"Uppskattade timmar","type":"number","required":true},{"key":"planned_workers","label":"Antal personal","type":"number","required":true}]'::jsonb,
    '{"labor_rate_per_hour":550,"currency":"SEK","source":"system_preset"}'::jsonb
  )
  on conflict do nothing
  returning id
)
insert into public.project_template_questions (project_template_id, question_key, label, input_type, unit_label, is_required, sort_order)
select id, 'square_meters', 'Antal kvm', 'number', 'kvm', true, 10 from public.project_templates where scope = 'system' and name = 'Fastighetsrenovering'
on conflict do nothing;

insert into public.project_template_questions (project_template_id, question_key, label, input_type, unit_label, is_required, sort_order)
select id, 'rooms', 'Antal rum', 'number', 'rum', false, 20 from public.project_templates where scope = 'system' and name = 'Fastighetsrenovering'
on conflict do nothing;

insert into public.project_template_questions (project_template_id, question_key, label, input_type, unit_label, is_required, sort_order)
select id, 'windows', 'Antal fönster', 'number', 'st', false, 30 from public.project_templates where scope = 'system' and name = 'Fastighetsrenovering'
on conflict do nothing;

insert into public.project_template_questions (project_template_id, question_key, label, input_type, options, is_required, sort_order)
select id, 'scope', 'Omfattning', 'select', '["hela","delar","rum","fönster"]'::jsonb, true, 40 from public.project_templates where scope = 'system' and name = 'Fastighetsrenovering'
on conflict do nothing;

insert into public.project_estimation_rules (scope, company_id, project_template_id, industry_type, rule_key, phase_key, work_item_title, driver_key, quantity_source, quantity_multiplier, minutes_per_unit, minimum_minutes, material_cost_per_unit, fixed_cost, applies_when, metadata)
select 'system', null, id, 'property', rule_key, phase_key, work_item_title, driver_key, quantity_source, quantity_multiplier, minutes_per_unit, minimum_minutes, material_cost_per_unit, fixed_cost, '{}'::jsonb, metadata
from public.project_templates
cross join (values
  ('site_review', 'planning', 'Projektgenomgång och besiktning', 'fixed', 'fixed', 1::numeric, 240::numeric, 240, 0::numeric, 0::numeric, '{"unit":"projekt"}'::jsonb),
  ('demolition', 'demolition', 'Rivning och förarbete', 'square_meters', 'square_meters', 1::numeric, 18::numeric, 240, 35::numeric, 0::numeric, '{"unit":"kvm"}'::jsonb),
  ('surface_work', 'build', 'Ytskikt och målning', 'square_meters', 'square_meters', 1::numeric, 32::numeric, 360, 180::numeric, 0::numeric, '{"unit":"kvm"}'::jsonb),
  ('room_finish', 'build', 'Rumsfinish och detaljarbete', 'rooms', 'rooms', 1::numeric, 180::numeric, 180, 900::numeric, 0::numeric, '{"unit":"rum"}'::jsonb),
  ('window_work', 'build', 'Fönsterarbete', 'windows', 'windows', 1::numeric, 150::numeric, 0, 1200::numeric, 0::numeric, '{"unit":"fönster"}'::jsonb),
  ('final_control', 'finish', 'Slutkontroll och överlämning', 'fixed', 'fixed', 1::numeric, 180::numeric, 180, 0::numeric, 0::numeric, '{"unit":"projekt"}'::jsonb)
) as rules(rule_key, phase_key, work_item_title, driver_key, quantity_source, quantity_multiplier, minutes_per_unit, minimum_minutes, material_cost_per_unit, fixed_cost, metadata)
where project_templates.scope = 'system' and project_templates.name = 'Fastighetsrenovering'
on conflict do nothing;

insert into public.platform_modules (code, name, description, is_core, sort_order)
values
  ('planning_templates', 'Planeringsmallar', 'Återanvändbara planeringsutkast, rutter och uppdragsmönster.', true, 82),
  ('project_planning', 'Projektplanering', 'Projektmallar, intake, kalkylregler och projektgenererade uppdrag.', true, 84)
on conflict (code) do update set name = excluded.name, description = excluded.description, is_core = excluded.is_core, sort_order = excluded.sort_order;

insert into public.company_modules (company_id, module_code, status, enabled_at, settings)
select c.id, module_code, 'active', timezone('utc', now()), '{}'::jsonb
from public.companies c
cross join (values ('planning_templates'), ('project_planning')) as modules(module_code)
on conflict (company_id, module_code) do update set status = excluded.status, enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at);

-- updated_at triggers.
drop trigger if exists trg_planning_templates_updated_at on public.planning_templates;
create trigger trg_planning_templates_updated_at before update on public.planning_templates
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_planning_template_items_updated_at on public.planning_template_items;
create trigger trg_planning_template_items_updated_at before update on public.planning_template_items
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_project_templates_updated_at on public.project_templates;
create trigger trg_project_templates_updated_at before update on public.project_templates
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_project_estimation_rules_updated_at on public.project_estimation_rules;
create trigger trg_project_estimation_rules_updated_at before update on public.project_estimation_rules
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at before update on public.projects
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_project_phases_updated_at on public.project_phases;
create trigger trg_project_phases_updated_at before update on public.project_phases
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_project_work_items_updated_at on public.project_work_items;
create trigger trg_project_work_items_updated_at before update on public.project_work_items
for each row execute procedure public.set_updated_at();

-- RLS.
alter table public.planning_templates enable row level security;
alter table public.planning_template_items enable row level security;
alter table public.planning_template_applications enable row level security;
alter table public.project_templates enable row level security;
alter table public.project_template_questions enable row level security;
alter table public.project_estimation_rules enable row level security;
alter table public.projects enable row level security;
alter table public.project_intake_answers enable row level security;
alter table public.project_phases enable row level security;
alter table public.project_work_items enable row level security;

drop policy if exists planning_templates_company_all on public.planning_templates;
create policy planning_templates_company_all on public.planning_templates
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists planning_template_items_company_all on public.planning_template_items;
create policy planning_template_items_company_all on public.planning_template_items
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists planning_template_applications_company_all on public.planning_template_applications;
create policy planning_template_applications_company_all on public.planning_template_applications
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists project_templates_select_visible on public.project_templates;
create policy project_templates_select_visible on public.project_templates
for select using (scope = 'system' or public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)));

drop policy if exists project_templates_company_write on public.project_templates;
create policy project_templates_company_write on public.project_templates
for all using (public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)))
with check (public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)));

drop policy if exists project_template_questions_select_visible on public.project_template_questions;
create policy project_template_questions_select_visible on public.project_template_questions
for select using (
  exists (
    select 1 from public.project_templates pt
    where pt.id = project_template_id
      and (pt.scope = 'system' or public.is_platform_admin() or (pt.company_id is not null and public.is_company_member(pt.company_id)))
  )
);

drop policy if exists project_template_questions_company_write on public.project_template_questions;
create policy project_template_questions_company_write on public.project_template_questions
for all using (public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)))
with check (public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)));

drop policy if exists project_estimation_rules_select_visible on public.project_estimation_rules;
create policy project_estimation_rules_select_visible on public.project_estimation_rules
for select using (scope = 'system' or public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)));

drop policy if exists project_estimation_rules_company_write on public.project_estimation_rules;
create policy project_estimation_rules_company_write on public.project_estimation_rules
for all using (public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)))
with check (public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)));

drop policy if exists projects_company_all on public.projects;
create policy projects_company_all on public.projects
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists project_intake_answers_company_all on public.project_intake_answers;
create policy project_intake_answers_company_all on public.project_intake_answers
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists project_phases_company_all on public.project_phases;
create policy project_phases_company_all on public.project_phases
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists project_work_items_company_all on public.project_work_items;
create policy project_work_items_company_all on public.project_work_items
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));
