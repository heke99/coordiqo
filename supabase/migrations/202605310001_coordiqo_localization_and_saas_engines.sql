-- Coordiqo Batch 3B-16 foundation
-- Localization, superadmin-controlled onboarding and tenant-safe SaaS engine underlay.
-- Safe/idempotent. Does not delete business data.

create extension if not exists pgcrypto;

-- Batch 3B: company locale and regional settings.
alter table public.company_settings
  add column if not exists locale text not null default 'sv',
  add column if not exists timezone text not null default 'Europe/Stockholm',
  add column if not exists currency text not null default 'SEK',
  add column if not exists date_format text not null default 'yyyy-MM-dd',
  add column if not exists time_format text not null default '24h';

alter table public.profiles
  add column if not exists preferred_locale text;

update public.company_settings cs
set
  locale = coalesce(nullif(cs.locale, ''), nullif(c.language_code, ''), 'sv'),
  timezone = coalesce(nullif(cs.timezone, ''), nullif(c.timezone, ''), 'Europe/Stockholm'),
  currency = coalesce(nullif(cs.currency, ''), 'SEK'),
  date_format = coalesce(nullif(cs.date_format, ''), 'yyyy-MM-dd'),
  time_format = coalesce(nullif(cs.time_format, ''), '24h'),
  updated_at = timezone('utc', now())
from public.companies c
where c.id = cs.company_id;

update public.companies
set language_code = coalesce(nullif(language_code, ''), 'sv'),
    timezone = coalesce(nullif(timezone, ''), 'Europe/Stockholm')
where language_code is null or language_code = '' or timezone is null or timezone = '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'company_settings_locale_check' and conrelid = 'public.company_settings'::regclass) then
    alter table public.company_settings
      add constraint company_settings_locale_check check (locale in ('sv', 'en'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'company_settings_time_format_check' and conrelid = 'public.company_settings'::regclass) then
    alter table public.company_settings
      add constraint company_settings_time_format_check check (time_format in ('24h', '12h'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_preferred_locale_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles
      add constraint profiles_preferred_locale_check check (preferred_locale is null or preferred_locale in ('sv', 'en'));
  end if;
end $$;

-- Capture requested onboarding metadata for superadmin review.
alter table public.company_access_requests
  add column if not exists industry_type text,
  add column if not exists operational_model text,
  add column if not exists timezone text not null default 'Europe/Stockholm',
  add column if not exists locale text not null default 'sv',
  add column if not exists currency text not null default 'SEK',
  add column if not exists default_region text,
  add column if not exists first_admin_email text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_company_settings_locale on public.company_settings(company_id, locale);
create index if not exists idx_company_access_requests_onboarding on public.company_access_requests(status, request_type, created_at desc) where archived_at is null;

-- Localization catalog and optional company overrides.
create table if not exists public.supported_locales (
  code text primary key,
  name text not null,
  native_name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.localized_strings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  scope text not null default 'system' check (scope in ('system', 'company')),
  namespace text not null default 'app',
  message_key text not null,
  locale_code text not null references public.supported_locales(code),
  value text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint localized_strings_scope_company_check check ((scope = 'system' and company_id is null) or (scope = 'company' and company_id is not null))
);

create unique index if not exists localized_strings_unique_idx
on public.localized_strings(scope, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), namespace, locale_code, message_key)
where archived_at is null;

insert into public.supported_locales (code, name, native_name, is_default, sort_order)
values
  ('sv', 'Swedish', 'Svenska', true, 10),
  ('en', 'English', 'English', false, 20)
on conflict (code) do update set
  name = excluded.name,
  native_name = excluded.native_name,
  is_default = excluded.is_default,
  is_active = true,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

-- Register the SaaS engines without forcing incomplete modules into active use.
insert into public.platform_modules (code, name, description, is_core, sort_order)
values
  ('localization', 'Localization', 'Company language, locale, currency and translated labels.', true, 26),
  ('optimization', 'Optimization', 'VROOM-compatible route and plan optimization runs.', true, 86),
  ('project_calculation', 'Project calculation', 'Project intake, calculation lines, pricing and generated work.', true, 87),
  ('project_actuals', 'Project actuals', 'Post-calculation, actual outcome and learning events.', true, 88),
  ('mobile_execution', 'Mobile execution', 'Field execution events, checklist answers and route progress.', true, 101),
  ('deviation_history', 'Deviation and history', 'Deviation handling, history events and SLA risk tracking.', true, 110),
  ('command_center_chat', 'Command center chat', 'Internal tenant chat, channels, messages and notifications.', true, 120),
  ('smart_groups', 'Smart groups', 'Automatic operation groups and chat context links.', true, 121),
  ('ai_orchestration', 'AI orchestration', 'Prompt registry, AI runs, decision logs and tenant model config.', true, 130),
  ('knowledge', 'Knowledge', 'Notion and knowledge-source sync for AI-supported operations.', true, 140),
  ('external_messaging', 'External messaging', 'SMS, email and external customer communication underlay.', true, 150),
  ('reporting_billing', 'Reporting and billing', 'Metrics, report snapshots, billing underlays and pricing rules.', true, 160),
  ('vertical_presets', 'Vertical presets', 'Industry presets, demo scenarios and sales-demo data control.', true, 170),
  ('enterprise_integrations', 'Enterprise integrations', 'API clients, webhooks, imports, calendars and exports.', true, 180),
  ('pilot_readiness', 'Pilot readiness', 'Pilot stabilization checklist and readiness status.', false, 190)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_core = excluded.is_core,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

insert into public.company_modules (company_id, module_code, status, enabled_at, settings)
select c.id, m.code, case when m.code = 'localization' then 'active' else 'planned' end,
       case when m.code = 'localization' then timezone('utc', now()) else null end,
       jsonb_build_object('source', 'saas_engine_foundation')
from public.companies c
cross join (values
  ('localization'),
  ('optimization'),
  ('project_calculation'),
  ('project_actuals'),
  ('mobile_execution'),
  ('deviation_history'),
  ('command_center_chat'),
  ('smart_groups'),
  ('ai_orchestration'),
  ('knowledge'),
  ('external_messaging'),
  ('reporting_billing'),
  ('vertical_presets'),
  ('enterprise_integrations'),
  ('pilot_readiness')
) as m(code)
on conflict (company_id, module_code) do update set
  status = case when excluded.module_code = 'localization' then 'active' else public.company_modules.status end,
  enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at),
  settings = coalesce(public.company_modules.settings, '{}'::jsonb) || excluded.settings,
  updated_at = timezone('utc', now());

-- Batch 4A: optimization/VROOM underlay.
create table if not exists public.optimization_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planning_run_id uuid references public.planning_runs(id) on delete set null,
  route_plan_group_id uuid references public.route_plan_groups(id) on delete set null,
  provider text not null default 'fallback',
  run_type text not null default 'route_optimization',
  plan_label text not null default 'Plan A',
  status text not null default 'draft' check (status in ('draft', 'running', 'completed', 'failed', 'approved', 'rejected', 'archived')),
  risk_score numeric not null default 0,
  blocking_count integer not null default 0,
  warning_count integer not null default 0,
  info_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  approval_reason text,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.optimization_run_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  optimization_run_id uuid not null references public.optimization_runs(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  resource_asset_id uuid references public.resource_assets(id) on delete set null,
  route_plan_stop_id uuid references public.route_plan_stops(id) on delete set null,
  item_type text not null default 'job',
  stop_order integer,
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  travel_seconds integer not null default 0,
  distance_meters integer not null default 0,
  waiting_seconds integer not null default 0,
  service_seconds integer not null default 0,
  status text not null default 'proposed',
  rule_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.optimization_unassigned_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  optimization_run_id uuid not null references public.optimization_runs(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  reason_code text not null default 'not_assignable',
  severity text not null default 'warning',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.optimization_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  optimization_run_id uuid not null references public.optimization_runs(id) on delete cascade,
  metric_key text not null,
  metric_value numeric not null default 0,
  unit text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique(optimization_run_id, metric_key)
);

create table if not exists public.optimization_provider_payloads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  optimization_run_id uuid not null references public.optimization_runs(id) on delete cascade,
  provider text not null,
  payload_kind text not null check (payload_kind in ('request', 'response', 'error')),
  payload jsonb not null default '{}'::jsonb,
  redacted boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.optimization_adjustments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  optimization_run_id uuid not null references public.optimization_runs(id) on delete cascade,
  optimization_run_item_id uuid references public.optimization_run_items(id) on delete cascade,
  adjustment_type text not null,
  reason text not null,
  before_value jsonb,
  after_value jsonb,
  rule_summary jsonb not null default '{}'::jsonb,
  adjusted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

-- Batch 4B: project calculation and automation.
alter table public.projects
  add column if not exists calculation_status text not null default 'not_calculated',
  add column if not exists approved_calculation_run_id uuid,
  add column if not exists actuals_status text not null default 'not_required',
  add column if not exists closed_at timestamptz;

create table if not exists public.project_estimation_rule_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  project_estimation_rule_id uuid references public.project_estimation_rules(id) on delete cascade,
  scope text not null default 'company' check (scope in ('system', 'company')),
  item_key text not null,
  line_type text not null default 'labor',
  quantity_source text not null default 'fixed',
  quantity_multiplier numeric not null default 1,
  unit_label text,
  unit_cost numeric not null default 0,
  unit_price numeric not null default 0,
  minutes_per_unit numeric not null default 0,
  applies_when jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint project_estimation_rule_items_scope_company_check check ((scope = 'system' and company_id is null) or (scope = 'company' and company_id is not null))
);

create table if not exists public.project_calculation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  project_template_id uuid references public.project_templates(id) on delete set null,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'calculated', 'waiting_for_approval', 'approved', 'rejected', 'archived')),
  source text not null default 'manual' check (source in ('manual', 'ai_suggestion', 'automation', 'import')),
  currency text not null default 'SEK',
  estimated_minutes integer not null default 0,
  internal_cost numeric not null default 0,
  recommended_price numeric not null default 0,
  price_low numeric,
  price_high numeric,
  margin_amount numeric not null default 0,
  margin_percent numeric not null default 0,
  risk_markup_percent numeric not null default 0,
  vat_percent numeric not null default 25,
  summary jsonb not null default '{}'::jsonb,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  approval_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, project_id, version)
);

create table if not exists public.project_calculation_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_calculation_run_id uuid not null references public.project_calculation_runs(id) on delete cascade,
  project_work_item_id uuid references public.project_work_items(id) on delete set null,
  phase_key text,
  item_key text not null,
  title text not null,
  line_type text not null default 'labor',
  quantity numeric not null default 1,
  unit_label text,
  unit_minutes numeric not null default 0,
  total_minutes integer not null default 0,
  unit_cost numeric not null default 0,
  total_cost numeric not null default 0,
  unit_price numeric not null default 0,
  total_price numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.project_calculation_assumptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_calculation_run_id uuid not null references public.project_calculation_runs(id) on delete cascade,
  assumption_key text not null,
  value jsonb not null default 'null'::jsonb,
  source text not null default 'system',
  confidence numeric,
  created_at timestamptz not null default timezone('utc', now()),
  unique(project_calculation_run_id, assumption_key)
);

create table if not exists public.project_generated_work_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  project_calculation_run_id uuid references public.project_calculation_runs(id) on delete set null,
  project_work_item_id uuid references public.project_work_items(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  generation_type text not null default 'task',
  status text not null default 'generated',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.project_cost_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  project_calculation_run_id uuid references public.project_calculation_runs(id) on delete cascade,
  cost_type text not null default 'labor',
  description text not null,
  quantity numeric not null default 1,
  unit_label text,
  unit_cost numeric not null default 0,
  total_cost numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.project_price_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  project_calculation_run_id uuid references public.project_calculation_runs(id) on delete cascade,
  price_type text not null default 'fixed',
  description text not null,
  quantity numeric not null default 1,
  unit_label text,
  unit_price numeric not null default 0,
  total_price numeric not null default 0,
  discount_amount numeric not null default 0,
  vat_percent numeric not null default 25,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.project_dependencies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  predecessor_work_item_id uuid references public.project_work_items(id) on delete cascade,
  successor_work_item_id uuid references public.project_work_items(id) on delete cascade,
  dependency_type text not null default 'finish_to_start',
  lag_minutes integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.project_risk_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  project_calculation_run_id uuid references public.project_calculation_runs(id) on delete set null,
  risk_code text not null,
  title text not null,
  severity text not null default 'warning',
  probability numeric,
  impact_amount numeric,
  mitigation text,
  status text not null default 'open',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.project_automation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  project_calculation_run_id uuid references public.project_calculation_runs(id) on delete set null,
  planning_run_id uuid references public.planning_runs(id) on delete set null,
  automation_type text not null default 'create_planning_draft',
  status text not null default 'pending',
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  archived_at timestamptz
);

-- Batch 4C: actuals, post-calculation and learning.
create table if not exists public.project_actuals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  calculation_run_id uuid references public.project_calculation_runs(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'closed', 'archived')),
  actual_start_at timestamptz,
  actual_completed_at timestamptz,
  actual_minutes integer not null default 0,
  actual_cost numeric not null default 0,
  actual_billing_amount numeric not null default 0,
  actual_margin_amount numeric not null default 0,
  deadline_status text,
  customer_satisfaction integer,
  summary jsonb not null default '{}'::jsonb,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(project_id)
);

create table if not exists public.project_actual_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_actual_id uuid not null references public.project_actuals(id) on delete cascade,
  project_work_item_id uuid references public.project_work_items(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  estimated_minutes integer not null default 0,
  actual_minutes integer not null default 0,
  estimated_cost numeric not null default 0,
  actual_cost numeric not null default 0,
  deviation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.project_actual_resource_usage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_actual_id uuid not null references public.project_actuals(id) on delete cascade,
  resource_asset_id uuid references public.resource_assets(id) on delete set null,
  usage_minutes integer not null default 0,
  cost numeric not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.project_actual_staff_usage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_actual_id uuid not null references public.project_actuals(id) on delete cascade,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  actual_minutes integer not null default 0,
  cost numeric not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.project_actual_deviation_reasons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_actual_id uuid not null references public.project_actuals(id) on delete cascade,
  reason_code text not null,
  description text,
  impact_minutes integer not null default 0,
  impact_cost numeric not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.project_learning_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  project_template_id uuid references public.project_templates(id) on delete set null,
  event_type text not null,
  recommendation text not null,
  confidence numeric,
  status text not null default 'pending' check (status in ('pending', 'approved', 'ignored', 'applied', 'archived')),
  before_value jsonb,
  after_value jsonb,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.project_benchmark_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  industry_type text,
  project_type text,
  region_code text,
  metric_key text not null,
  sample_size integer not null default 0,
  p50_value numeric,
  p80_value numeric,
  average_value numeric,
  unit text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.project_rule_recommendations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_estimation_rule_id uuid references public.project_estimation_rules(id) on delete set null,
  recommendation_type text not null,
  current_value jsonb,
  recommended_value jsonb not null,
  reason text not null,
  confidence numeric,
  status text not null default 'pending',
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.project_closure_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  project_actual_id uuid references public.project_actuals(id) on delete set null,
  status text not null default 'draft',
  report_data jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default timezone('utc', now()),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  archived_at timestamptz
);

-- Batch 5: mobile execution.
create table if not exists public.mobile_checklist_responses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  checklist_key text not null,
  item_key text not null,
  response_value jsonb not null default 'null'::jsonb,
  status text not null default 'answered',
  answered_by uuid references public.profiles(id) on delete set null,
  answered_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz
);

create table if not exists public.mobile_execution_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  task_assignment_id uuid references public.task_assignments(id) on delete set null,
  route_plan_stop_id uuid references public.route_plan_stops(id) on delete set null,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  event_type text not null,
  event_status text not null default 'completed',
  event_at timestamptz not null default timezone('utc', now()),
  latitude numeric,
  longitude numeric,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

-- Batch 6: deviation and history engine.
create table if not exists public.deviation_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  scope text not null default 'company' check (scope in ('system', 'company')),
  code text not null,
  name text not null,
  description text,
  default_priority text not null default 'normal',
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint deviation_categories_scope_company_check check ((scope = 'system' and company_id is null) or (scope = 'company' and company_id is not null))
);

create unique index if not exists deviation_categories_unique_idx
on public.deviation_categories(scope, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), code)
where archived_at is null;

create table if not exists public.deviations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  deviation_category_id uuid references public.deviation_categories(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed', 'cancelled', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  route_plan_group_id uuid references public.route_plan_groups(id) on delete set null,
  route_plan_stop_id uuid references public.route_plan_stops(id) on delete set null,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  resource_asset_id uuid references public.resource_assets(id) on delete set null,
  customer_impact boolean not null default false,
  route_impact boolean not null default false,
  billing_impact boolean not null default false,
  sla_risk boolean not null default false,
  resolved_at timestamptz,
  resolution text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.deviation_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  deviation_id uuid not null references public.deviations(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.deviation_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  deviation_id uuid not null references public.deviations(id) on delete cascade,
  linked_entity_type text not null,
  linked_entity_id uuid not null,
  link_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(deviation_id, linked_entity_type, linked_entity_id)
);

create table if not exists public.history_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type text not null,
  event_at timestamptz not null default timezone('utc', now()),
  actor_user_id uuid references public.profiles(id) on delete set null,
  related_entity_type text,
  related_entity_id uuid,
  task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  deviation_id uuid references public.deviations(id) on delete set null,
  route_plan_group_id uuid references public.route_plan_groups(id) on delete set null,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  resource_asset_id uuid references public.resource_assets(id) on delete set null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.sla_risk_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  deviation_id uuid references public.deviations(id) on delete set null,
  risk_level text not null default 'warning',
  risk_code text not null,
  due_at timestamptz,
  detected_at timestamptz not null default timezone('utc', now()),
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

-- Batch 7-8: command center chat and smart groups.
create table if not exists public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  channel_type text not null default 'group',
  name text not null,
  description text,
  visibility text not null default 'members',
  related_entity_type text,
  related_entity_id uuid,
  is_system boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.chat_channel_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  chat_channel_id uuid not null references public.chat_channels(id) on delete cascade,
  membership_id uuid references public.company_memberships(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'member',
  notification_level text not null default 'normal',
  joined_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  chat_channel_id uuid not null references public.chat_channels(id) on delete cascade,
  sender_user_id uuid references public.profiles(id) on delete set null,
  message_type text not null default 'text',
  body text not null,
  importance text not null default 'normal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.chat_message_reads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  chat_message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default timezone('utc', now()),
  unique(chat_message_id, user_id)
);

create table if not exists public.chat_message_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  chat_message_id uuid not null references public.chat_messages(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes integer,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.chat_message_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  chat_message_id uuid not null references public.chat_messages(id) on delete cascade,
  linked_entity_type text not null,
  linked_entity_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.chat_pins (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  chat_channel_id uuid not null references public.chat_channels(id) on delete cascade,
  chat_message_id uuid not null references public.chat_messages(id) on delete cascade,
  pinned_by uuid references public.profiles(id) on delete set null,
  pinned_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(chat_channel_id, chat_message_id)
);

create table if not exists public.chat_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  chat_channel_id uuid references public.chat_channels(id) on delete cascade,
  chat_message_id uuid references public.chat_messages(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'unread',
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.smart_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  group_type text not null default 'dynamic',
  status text not null default 'active',
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, code)
);

create table if not exists public.smart_group_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  smart_group_id uuid not null references public.smart_groups(id) on delete cascade,
  rule_type text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.smart_group_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  smart_group_id uuid not null references public.smart_groups(id) on delete cascade,
  membership_id uuid references public.company_memberships(id) on delete cascade,
  staff_profile_id uuid references public.staff_profiles(id) on delete cascade,
  source text not null default 'rule',
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.chat_context_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  chat_channel_id uuid references public.chat_channels(id) on delete cascade,
  smart_group_id uuid references public.smart_groups(id) on delete cascade,
  context_type text not null,
  context_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  alert_type text not null,
  severity text not null default 'info',
  title text not null,
  body text,
  target_channel_id uuid references public.chat_channels(id) on delete set null,
  related_entity_type text,
  related_entity_id uuid,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  archived_at timestamptz
);

-- Batch 9: AI orchestration, Langflow and Langfuse underlay.
create table if not exists public.ai_prompt_registry (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  scope text not null default 'company' check (scope in ('system', 'company')),
  prompt_key text not null,
  locale text not null default 'sv',
  title text not null,
  prompt_template text not null,
  version integer not null default 1,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint ai_prompt_registry_scope_company_check check ((scope = 'system' and company_id is null) or (scope = 'company' and company_id is not null))
);

create table if not exists public.ai_model_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null default 'langflow',
  model_key text not null,
  status text not null default 'active',
  config jsonb not null default '{}'::jsonb,
  cost_limit_daily numeric,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, provider, model_key)
);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ai_prompt_registry_id uuid references public.ai_prompt_registry(id) on delete set null,
  model_config_id uuid references public.ai_model_configs(id) on delete set null,
  langfuse_trace_id text,
  langflow_flow_id text,
  run_type text not null,
  locale text not null default 'sv',
  status text not null default 'queued',
  input_summary text,
  output_summary text,
  related_entity_type text,
  related_entity_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz
);

create table if not exists public.ai_run_steps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ai_run_id uuid not null references public.ai_runs(id) on delete cascade,
  step_key text not null,
  status text not null default 'completed',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.ai_decision_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ai_run_id uuid references public.ai_runs(id) on delete set null,
  decision_type text not null,
  suggested_action text,
  validation_status text not null default 'pending',
  human_decision text,
  decision_reason text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.ai_cost_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ai_run_id uuid references public.ai_runs(id) on delete cascade,
  provider text not null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_amount numeric not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default timezone('utc', now())
);

-- Batch 10: Notion and knowledge source.
create table if not exists public.notion_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  workspace_name text,
  notion_workspace_id text,
  status text not null default 'inactive',
  access_token_ref text,
  config jsonb not null default '{}'::jsonb,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_type text not null default 'notion',
  name text not null,
  status text not null default 'active',
  external_id text,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  knowledge_source_id uuid references public.knowledge_sources(id) on delete cascade,
  title text not null,
  external_id text,
  url text,
  locale text not null default 'sv',
  status text not null default 'active',
  checksum text,
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  knowledge_document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(knowledge_document_id, chunk_index)
);

create table if not exists public.knowledge_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  knowledge_document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  linked_entity_type text not null,
  linked_entity_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.notion_sync_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  notion_connection_id uuid references public.notion_connections(id) on delete cascade,
  status text not null default 'queued',
  documents_seen integer not null default 0,
  documents_updated integer not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

-- Batch 11: external messaging.
create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  channel_type text not null default 'sms',
  subject text,
  customer_label text,
  related_entity_type text,
  related_entity_id uuid,
  status text not null default 'open',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.external_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  message_thread_id uuid references public.message_threads(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  channel_type text not null default 'sms',
  from_address text,
  to_address text,
  body text not null,
  status text not null default 'queued',
  provider_message_id text,
  requires_approval boolean not null default false,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  scope text not null default 'company' check (scope in ('system', 'company')),
  template_key text not null,
  locale text not null default 'sv',
  name text not null,
  body text not null,
  status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint sms_templates_scope_company_check check ((scope = 'system' and company_id is null) or (scope = 'company' and company_id is not null))
);

create table if not exists public.message_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  external_message_id uuid references public.external_messages(id) on delete cascade,
  provider text not null,
  status text not null,
  provider_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customer_communication_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  message_thread_id uuid references public.message_threads(id) on delete set null,
  external_message_id uuid references public.external_messages(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  deviation_id uuid references public.deviations(id) on delete set null,
  communication_type text not null,
  summary text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

-- Batch 12-14: reports, billing, presets and integrations.
create table if not exists public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  report_type text not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'ready',
  data jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.dashboard_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  metric_scope text not null default 'company',
  metric_key text not null,
  metric_date date not null default current_date,
  numeric_value numeric not null default 0,
  dimension jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique(company_id, metric_scope, metric_key, metric_date, dimension)
);

create table if not exists public.billing_underlays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_label text,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft',
  currency text not null default 'SEK',
  subtotal_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  total_amount numeric not null default 0,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.billing_underlay_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  billing_underlay_id uuid not null references public.billing_underlays(id) on delete cascade,
  item_type text not null,
  description text not null,
  task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  route_plan_group_id uuid references public.route_plan_groups(id) on delete set null,
  quantity numeric not null default 1,
  unit_label text,
  unit_price numeric not null default 0,
  total_price numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  scope text not null default 'company' check (scope in ('system', 'company')),
  industry_type text,
  rule_key text not null,
  name text not null,
  status text not null default 'active',
  currency text not null default 'SEK',
  config jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint pricing_rules_scope_company_check check ((scope = 'system' and company_id is null) or (scope = 'company' and company_id is not null))
);

create table if not exists public.pricing_rule_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  pricing_rule_id uuid not null references public.pricing_rules(id) on delete cascade,
  item_key text not null,
  calculation_type text not null default 'fixed',
  unit_label text,
  unit_price numeric not null default 0,
  config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.export_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  export_type text not null,
  status text not null default 'queued',
  file_path text,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.demo_scenarios (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  scope text not null default 'system' check (scope in ('system', 'company')),
  industry_type text not null,
  scenario_key text not null,
  name text not null,
  description text,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint demo_scenarios_scope_company_check check ((scope = 'system' and company_id is null) or (scope = 'company' and company_id is not null))
);

create table if not exists public.demo_seed_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  demo_scenario_id uuid references public.demo_scenarios(id) on delete set null,
  status text not null default 'queued',
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.industry_preset_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  scope text not null default 'system' check (scope in ('system', 'company')),
  industry_type text not null,
  rule_key text not null,
  rule_type text not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint industry_preset_rules_scope_company_check check ((scope = 'system' and company_id is null) or (scope = 'company' and company_id is not null))
);

create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  scopes text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, name)
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  api_client_id uuid not null references public.api_clients(id) on delete cascade,
  key_prefix text not null,
  key_hash text not null,
  status text not null default 'active',
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  archived_at timestamptz,
  unique(key_hash)
);

create table if not exists public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  target_url text not null,
  event_types text[] not null default '{}',
  status text not null default 'active',
  secret_ref text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  webhook_subscription_id uuid references public.webhook_subscriptions(id) on delete cascade,
  event_type text not null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  request_payload jsonb not null default '{}'::jsonb,
  response_status integer,
  response_body text,
  next_attempt_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  delivered_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  import_type text not null,
  source_name text,
  status text not null default 'queued',
  rows_total integer not null default 0,
  rows_imported integer not null default 0,
  rows_failed integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.import_run_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  import_run_id uuid not null references public.import_runs(id) on delete cascade,
  row_number integer,
  status text not null default 'pending',
  source_payload jsonb not null default '{}'::jsonb,
  mapped_entity_type text,
  mapped_entity_id uuid,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  account_label text,
  status text not null default 'inactive',
  token_ref text,
  config jsonb not null default '{}'::jsonb,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.chat_bridges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  bridge_name text not null,
  status text not null default 'inactive',
  config jsonb not null default '{}'::jsonb,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.enterprise_exports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  export_type text not null,
  status text not null default 'queued',
  destination text,
  file_path text,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  scope text not null default 'company' check (scope in ('platform', 'company')),
  provider text not null,
  status text not null default 'inactive',
  config jsonb not null default '{}'::jsonb,
  secret_ref text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint integration_settings_scope_company_check check ((scope = 'platform' and company_id is null) or (scope = 'company' and company_id is not null))
);

-- Helpful indexes for tenant-owned engines.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'localized_strings',
    'optimization_runs','optimization_run_items','optimization_unassigned_jobs','optimization_metrics','optimization_provider_payloads','optimization_adjustments',
    'project_estimation_rule_items','project_calculation_runs','project_calculation_items','project_calculation_assumptions','project_generated_work_items','project_cost_lines','project_price_lines','project_dependencies','project_risk_items','project_automation_runs',
    'project_actuals','project_actual_items','project_actual_resource_usage','project_actual_staff_usage','project_actual_deviation_reasons','project_learning_events','project_benchmark_snapshots','project_rule_recommendations','project_closure_reports',
    'mobile_checklist_responses','mobile_execution_events',
    'deviation_categories','deviations','deviation_events','deviation_links','history_events','sla_risk_events',
    'chat_channels','chat_channel_members','chat_messages','chat_message_reads','chat_message_attachments','chat_message_links','chat_pins','chat_notifications',
    'smart_groups','smart_group_rules','smart_group_memberships','chat_context_links','system_alerts',
    'ai_prompt_registry','ai_model_configs','ai_runs','ai_run_steps','ai_decision_logs','ai_cost_logs',
    'notion_connections','knowledge_sources','knowledge_documents','knowledge_chunks','knowledge_links','notion_sync_runs',
    'message_threads','external_messages','sms_templates','message_delivery_logs','customer_communication_logs',
    'report_snapshots','dashboard_metrics','billing_underlays','billing_underlay_items','pricing_rules','pricing_rule_items','export_runs',
    'demo_scenarios','demo_seed_runs','industry_preset_rules',
    'api_clients','api_keys','webhook_subscriptions','webhook_deliveries','import_runs','import_run_items','calendar_connections','chat_bridges','enterprise_exports','integration_settings'
  ]
  loop
    if to_regclass('public.' || v_table) is not null then
      execute format('create index if not exists %I on public.%I(company_id)', 'idx_' || v_table || '_company', v_table);
      execute format('alter table public.%I enable row level security', v_table);
    end if;
  end loop;
end $$;

create index if not exists idx_optimization_runs_company_status on public.optimization_runs(company_id, status, created_at desc) where archived_at is null;
create index if not exists idx_project_calculation_runs_company_project on public.project_calculation_runs(company_id, project_id, status) where archived_at is null;
create index if not exists idx_project_actuals_company_status on public.project_actuals(company_id, status, created_at desc) where archived_at is null;
create index if not exists idx_deviations_company_status on public.deviations(company_id, status, priority, created_at desc) where archived_at is null;
create index if not exists idx_chat_messages_channel_created on public.chat_messages(company_id, chat_channel_id, created_at desc) where archived_at is null;
create index if not exists idx_ai_runs_company_type_created on public.ai_runs(company_id, run_type, created_at desc) where archived_at is null;
create index if not exists idx_external_messages_thread_created on public.external_messages(company_id, message_thread_id, created_at desc) where archived_at is null;
create index if not exists idx_dashboard_metrics_company_date on public.dashboard_metrics(company_id, metric_date desc, metric_key);
create index if not exists idx_billing_underlays_company_period on public.billing_underlays(company_id, period_start, period_end, status) where archived_at is null;

-- Updated-at triggers for tables with updated_at.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'supported_locales','localized_strings','optimization_runs','optimization_run_items',
    'project_estimation_rule_items','project_calculation_runs','project_risk_items','project_actuals',
    'deviation_categories','deviations','chat_channels','chat_messages','smart_groups','smart_group_rules',
    'ai_prompt_registry','ai_model_configs','notion_connections','knowledge_sources','knowledge_documents','knowledge_chunks',
    'message_threads','sms_templates','billing_underlays','pricing_rules','pricing_rule_items','demo_scenarios',
    'industry_preset_rules','api_clients','webhook_subscriptions','calendar_connections','chat_bridges','integration_settings'
  ]
  loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop trigger if exists %I on public.%I', 'trg_' || v_table || '_updated_at', v_table);
      execute format('create trigger %I before update on public.%I for each row execute procedure public.set_updated_at()', 'trg_' || v_table || '_updated_at', v_table);
    end if;
  end loop;
end $$;

-- RLS policies. System-scope tables allow system rows to be read by all authenticated users,
-- company rows remain tenant-isolated. Writes are server/action driven and require company admin/planner.
alter table public.supported_locales enable row level security;
drop policy if exists supported_locales_select on public.supported_locales;
create policy supported_locales_select on public.supported_locales for select using (true);
drop policy if exists supported_locales_admin_write on public.supported_locales;
create policy supported_locales_admin_write on public.supported_locales for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'localized_strings','deviation_categories','ai_prompt_registry','sms_templates','pricing_rules','demo_scenarios','industry_preset_rules','integration_settings'
  ]
  loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop policy if exists %I on public.%I', v_table || '_select', v_table);
      execute format('create policy %I on public.%I for select using (scope in (''system'', ''platform'') or public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)))', v_table || '_select', v_table);
      execute format('drop policy if exists %I on public.%I', v_table || '_write', v_table);
      execute format('create policy %I on public.%I for all using (public.is_platform_admin() or (company_id is not null and public.has_company_role(company_id, ''company_admin''))) with check (public.is_platform_admin() or (company_id is not null and public.has_company_role(company_id, ''company_admin'')))', v_table || '_write', v_table);
    end if;
  end loop;
end $$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'optimization_runs','optimization_run_items','optimization_unassigned_jobs','optimization_metrics','optimization_provider_payloads','optimization_adjustments',
    'project_estimation_rule_items','project_calculation_runs','project_calculation_items','project_calculation_assumptions','project_generated_work_items','project_cost_lines','project_price_lines','project_dependencies','project_risk_items','project_automation_runs',
    'project_actuals','project_actual_items','project_actual_resource_usage','project_actual_staff_usage','project_actual_deviation_reasons','project_learning_events','project_benchmark_snapshots','project_rule_recommendations','project_closure_reports',
    'mobile_checklist_responses','mobile_execution_events',
    'deviations','deviation_events','deviation_links','history_events','sla_risk_events',
    'smart_groups','smart_group_rules','smart_group_memberships','chat_context_links','system_alerts',
    'ai_model_configs','ai_runs','ai_run_steps','ai_decision_logs','ai_cost_logs',
    'notion_connections','knowledge_sources','knowledge_documents','knowledge_chunks','knowledge_links','notion_sync_runs',
    'message_threads','external_messages','message_delivery_logs','customer_communication_logs',
    'report_snapshots','dashboard_metrics','billing_underlays','billing_underlay_items','pricing_rule_items','export_runs',
    'demo_seed_runs','api_clients','api_keys','webhook_subscriptions','webhook_deliveries','import_runs','import_run_items','calendar_connections','chat_bridges','enterprise_exports'
  ]
  loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop policy if exists %I on public.%I', v_table || '_select', v_table);
      execute format('create policy %I on public.%I for select using (public.is_platform_admin() or public.is_company_member(company_id))', v_table || '_select', v_table);
      execute format('drop policy if exists %I on public.%I', v_table || '_write', v_table);
      execute format('create policy %I on public.%I for all using (public.is_platform_admin() or public.has_company_role(company_id, ''planner'')) with check (public.is_platform_admin() or public.has_company_role(company_id, ''planner''))', v_table || '_write', v_table);
    end if;
  end loop;
end $$;

-- Chat can be used by normal active company members.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'chat_channels','chat_channel_members','chat_messages','chat_message_reads','chat_message_attachments','chat_message_links','chat_pins','chat_notifications'
  ]
  loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop policy if exists %I on public.%I', v_table || '_select', v_table);
      execute format('create policy %I on public.%I for select using (public.is_platform_admin() or public.is_company_member(company_id))', v_table || '_select', v_table);
      execute format('drop policy if exists %I on public.%I', v_table || '_write', v_table);
      execute format('create policy %I on public.%I for all using (public.is_platform_admin() or public.is_company_member(company_id)) with check (public.is_platform_admin() or public.is_company_member(company_id))', v_table || '_write', v_table);
    end if;
  end loop;
end $$;

-- Superadmin-controlled onboarding: the old bootstrap RPC now creates an access request,
-- not a live tenant. A platform admin must approve it.
drop function if exists public.bootstrap_company_for_current_user(text, text, text, text, text, text);

create or replace function public.bootstrap_company_for_current_user(
  p_company_name text,
  p_org_number text default null,
  p_industry_type text default 'other',
  p_operational_model text default 'object_based',
  p_timezone text default 'Europe/Stockholm',
  p_default_team_name text default 'Huvudteam',
  p_locale text default 'sv'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if trim(coalesce(p_company_name, '')) = '' then
    raise exception 'Company name is required';
  end if;

  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

  select email into v_email from auth.users where id = v_user_id;

  insert into public.company_access_requests (
    requester_user_id,
    requester_email,
    company_name,
    request_type,
    requested_role,
    message,
    industry_type,
    operational_model,
    timezone,
    locale,
    currency,
    first_admin_email,
    metadata
  )
  values (
    v_user_id,
    v_email,
    trim(p_company_name),
    'new_company_review',
    'company_admin',
    nullif(trim(coalesce(p_org_number, '')), ''),
    coalesce(nullif(trim(coalesce(p_industry_type, '')), ''), 'other'),
    coalesce(nullif(trim(coalesce(p_operational_model, '')), ''), 'object_based'),
    coalesce(nullif(trim(coalesce(p_timezone, '')), ''), 'Europe/Stockholm'),
    case when coalesce(nullif(trim(coalesce(p_locale, '')), ''), 'sv') in ('sv', 'en') then coalesce(nullif(trim(coalesce(p_locale, '')), ''), 'sv') else 'sv' end,
    'SEK',
    v_email,
    jsonb_build_object(
      'org_number', nullif(trim(coalesce(p_org_number, '')), ''),
      'default_team_name', coalesce(nullif(trim(coalesce(p_default_team_name, '')), ''), 'Huvudteam'),
      'source', 'superadmin_review_onboarding'
    )
  )
  returning id into v_request_id;

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    null,
    v_user_id,
    'company_access_requested',
    'company_access_request',
    v_request_id::text,
    jsonb_build_object('company_name', trim(p_company_name), 'source', 'superadmin_review_onboarding')
  );

  return v_request_id;
end;
$$;

grant execute on function public.bootstrap_company_for_current_user(text, text, text, text, text, text, text) to authenticated;

-- Company-level readiness overview for the SaaS engines.
create or replace view public.coordiqo_saas_readiness_v
with (security_invoker = true)
as
select
  c.id as company_id,
  c.name as company_name,
  coalesce(cs.locale, c.language_code, 'sv') as locale,
  coalesce(cs.timezone, c.timezone, 'Europe/Stockholm') as timezone,
  coalesce(cs.currency, 'SEK') as currency,
  c.status as company_status,
  coalesce(c.lifecycle_status, 'active') as lifecycle_status,
  (select count(*) from public.company_modules cm where cm.company_id = c.id and cm.status = 'active') as active_module_count,
  (select count(*) from public.company_modules cm where cm.company_id = c.id and cm.status = 'planned') as planned_module_count,
  (select count(*) from public.optimization_runs r where r.company_id = c.id and r.archived_at is null) as optimization_runs,
  (select count(*) from public.project_calculation_runs r where r.company_id = c.id and r.archived_at is null) as project_calculations,
  (select count(*) from public.deviations d where d.company_id = c.id and d.archived_at is null and d.status in ('open','in_progress')) as open_deviations,
  (select count(*) from public.chat_channels ch where ch.company_id = c.id and ch.archived_at is null) as chat_channels,
  (select count(*) from public.ai_runs ar where ar.company_id = c.id and ar.archived_at is null) as ai_runs,
  case
    when c.status <> 'active' then 'company_not_active'
    when coalesce(c.lifecycle_status, 'active') <> 'active' then 'company_not_approved'
    when cs.company_id is null then 'missing_company_settings'
    when coalesce(cs.locale, c.language_code, '') not in ('sv','en') then 'unsupported_locale'
    else 'ready'
  end as readiness_status
from public.companies c
left join public.company_settings cs on cs.company_id = c.id;

