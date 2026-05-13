-- Coordiqo Batch 8A + 8B
-- Planning core foundation, candidate scoring, draft planning and manual assignment.

create extension if not exists pgcrypto;

create table if not exists public.planning_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null default 'Planeringskörning',
  status text not null default 'draft' check (status in ('draft', 'running', 'completed', 'failed', 'cancelled', 'published')),
  planning_date date,
  date_from date,
  date_to date,
  team_id uuid references public.teams(id) on delete set null,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  industry_type text,
  task_type_id uuid references public.task_types(id) on delete set null,
  area_label text,
  unscheduled_only boolean not null default true,
  include_locked_assignments boolean not null default true,
  source_type text not null default 'manual' check (source_type in ('manual', 'planning_run', 'template', 'project', 'ai_suggestion', 'replan', 'what_if')),
  source_id uuid,
  project_id uuid,
  project_phase_id uuid,
  project_work_item_id uuid,
  filters jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint planning_runs_date_order check (date_to is null or date_from is null or date_to >= date_from)
);

create table if not exists public.planning_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planning_run_id uuid references public.planning_runs(id) on delete set null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'reviewing', 'published', 'cancelled', 'archived')),
  source_type text not null default 'planning_run' check (source_type in ('manual', 'planning_run', 'template', 'project', 'ai_suggestion', 'replan', 'what_if')),
  source_id uuid,
  project_id uuid,
  project_phase_id uuid,
  project_work_item_id uuid,
  date_from date,
  date_to date,
  team_id uuid references public.teams(id) on delete set null,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  summary text,
  summary_json jsonb not null default '{}'::jsonb,
  conflict_summary jsonb not null default '{}'::jsonb,
  change_summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.planning_draft_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planning_draft_id uuid not null references public.planning_drafts(id) on delete cascade,
  planning_run_id uuid references public.planning_runs(id) on delete set null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  candidate_id uuid,
  assignment_id uuid,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  shift_id uuid references public.shifts(id) on delete set null,
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  status text not null default 'proposed' check (status in ('draft', 'proposed', 'accepted', 'rejected', 'published', 'cancelled', 'archived')),
  score numeric not null default 0,
  eligible boolean not null default true,
  conflict_level text not null default 'none' check (conflict_level in ('none', 'info', 'warning', 'soft', 'hard', 'blocked')),
  is_locked boolean not null default false,
  locked_reason text,
  rejection_reason text,
  explanation text,
  sort_order integer not null default 100,
  source_type text not null default 'planning_run' check (source_type in ('manual', 'planning_run', 'template', 'project', 'ai_suggestion', 'replan', 'what_if')),
  source_id uuid,
  project_id uuid,
  project_phase_id uuid,
  project_work_item_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint planning_draft_items_time_order check (planned_end_at is null or planned_start_at is null or planned_end_at > planned_start_at)
);

create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  shift_id uuid references public.shifts(id) on delete set null,
  planning_run_id uuid references public.planning_runs(id) on delete set null,
  planning_draft_id uuid references public.planning_drafts(id) on delete set null,
  planning_draft_item_id uuid references public.planning_draft_items(id) on delete set null,
  planned_start_at timestamptz not null,
  planned_end_at timestamptz not null,
  status text not null default 'assigned' check (status in ('draft', 'proposed', 'assigned', 'confirmed', 'completed', 'cancelled', 'archived')),
  source_type text not null default 'manual' check (source_type in ('manual', 'planning_run', 'template', 'project', 'ai_suggestion', 'replan', 'what_if')),
  source_id uuid,
  project_id uuid,
  project_phase_id uuid,
  project_work_item_id uuid,
  is_locked boolean not null default false,
  locked_reason text,
  override_reason text,
  conflict_override_approved boolean not null default false,
  explanation text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint task_assignments_target_check check (staff_profile_id is not null or team_id is not null),
  constraint task_assignments_time_order check (planned_end_at > planned_start_at)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'planning_draft_items_assignment_fk'
      and conrelid = 'public.planning_draft_items'::regclass
  ) then
    alter table public.planning_draft_items
      add constraint planning_draft_items_assignment_fk
      foreign key (assignment_id) references public.task_assignments(id) on delete set null;
  end if;
end $$;

create table if not exists public.assignment_candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planning_run_id uuid references public.planning_runs(id) on delete set null,
  planning_draft_id uuid references public.planning_drafts(id) on delete set null,
  planning_draft_item_id uuid references public.planning_draft_items(id) on delete set null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  shift_id uuid references public.shifts(id) on delete set null,
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  score numeric not null default 0,
  eligible boolean not null default false,
  rejection_reason text,
  explanation text,
  source_type text not null default 'planning_run' check (source_type in ('manual', 'planning_run', 'template', 'project', 'ai_suggestion', 'replan', 'what_if')),
  source_id uuid,
  project_id uuid,
  project_phase_id uuid,
  project_work_item_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint assignment_candidates_target_check check (staff_profile_id is not null or team_id is not null)
);

create table if not exists public.candidate_score_breakdown (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.assignment_candidates(id) on delete cascade,
  score_key text not null,
  label text not null,
  points numeric not null default 0,
  max_points numeric,
  is_blocking boolean not null default false,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.planning_conflicts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planning_run_id uuid references public.planning_runs(id) on delete set null,
  planning_draft_id uuid references public.planning_drafts(id) on delete set null,
  planning_draft_item_id uuid references public.planning_draft_items(id) on delete set null,
  task_assignment_id uuid references public.task_assignments(id) on delete set null,
  candidate_id uuid references public.assignment_candidates(id) on delete set null,
  task_id uuid references public.tasks(id) on delete cascade,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  shift_id uuid references public.shifts(id) on delete set null,
  conflict_type text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'soft', 'hard', 'critical', 'blocked')),
  status text not null default 'open' check (status in ('open', 'overridden', 'resolved', 'superseded', 'ignored')),
  message text not null,
  details jsonb not null default '{}'::jsonb,
  project_id uuid,
  project_phase_id uuid,
  project_work_item_id uuid,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.planning_conflict_resolutions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conflict_id uuid not null references public.planning_conflicts(id) on delete cascade,
  resolution_type text not null default 'resolved' check (resolution_type in ('resolved', 'override', 'reassign', 'accept_risk', 'ignore', 'supersede')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.planning_publications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planning_run_id uuid references public.planning_runs(id) on delete set null,
  planning_draft_id uuid not null references public.planning_drafts(id) on delete cascade,
  status text not null default 'published' check (status in ('published', 'partial', 'failed', 'cancelled')),
  selected_draft_item_ids uuid[] not null default '{}'::uuid[],
  published_assignment_ids uuid[] not null default '{}'::uuid[],
  skipped_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.planning_scoring_weights (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'system' check (scope in ('system', 'company')),
  company_id uuid references public.companies(id) on delete cascade,
  industry_type text,
  score_key text not null,
  label text not null,
  points numeric not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(scope, company_id, industry_type, score_key)
);

create index if not exists idx_planning_runs_company_status on public.planning_runs(company_id, status, created_at desc) where archived_at is null;
create index if not exists idx_planning_drafts_company_status on public.planning_drafts(company_id, status, created_at desc) where archived_at is null;
create index if not exists idx_planning_draft_items_draft on public.planning_draft_items(planning_draft_id, status) where archived_at is null;
create index if not exists idx_task_assignments_task on public.task_assignments(company_id, task_id, status) where archived_at is null;
create index if not exists idx_task_assignments_staff_time on public.task_assignments(staff_profile_id, planned_start_at, planned_end_at) where archived_at is null;
create index if not exists idx_task_assignments_shift on public.task_assignments(shift_id) where archived_at is null;
create index if not exists idx_assignment_candidates_task on public.assignment_candidates(company_id, task_id, score desc) where archived_at is null;
create index if not exists idx_candidate_score_breakdown_candidate on public.candidate_score_breakdown(candidate_id);
create index if not exists idx_planning_conflicts_company_status on public.planning_conflicts(company_id, status, severity) where archived_at is null;
create index if not exists idx_planning_conflicts_task on public.planning_conflicts(task_id, status) where archived_at is null;
create index if not exists idx_planning_publications_draft on public.planning_publications(planning_draft_id);

insert into public.planning_scoring_weights (scope, company_id, industry_type, score_key, label, points, metadata)
values
  ('system', null, null, 'availability', 'Tillgänglig personal', 30, '{}'::jsonb),
  ('system', null, null, 'skill_match', 'Rätt kompetens', 25, '{}'::jsonb),
  ('system', null, null, 'certification_match', 'Rätt certifikat', 25, '{}'::jsonb),
  ('system', null, null, 'valid_certificate', 'Certifikat giltigt', 15, '{}'::jsonb),
  ('system', null, null, 'capacity', 'Tillräcklig kapacitet', 20, '{}'::jsonb),
  ('system', null, null, 'time_window', 'Matchar tidsfönster', 20, '{}'::jsonb),
  ('system', null, null, 'continuity', 'Kontinuitet', 15, '{}'::jsonb),
  ('system', null, null, 'area_match', 'Rätt team/område', 10, '{}'::jsonb),
  ('system', null, null, 'soft_conflict', 'Mjuk konflikt', -10, '{}'::jsonb),
  ('system', null, null, 'overload', 'Överbelastning', -25, '{}'::jsonb)
on conflict do nothing;

insert into public.platform_modules (code, name, description, is_core, sort_order)
values ('planning_core', 'Planeringsmotor', 'Planeringskörningar, utkast, kandidater, konflikter och publicering.', true, 80)
on conflict (code) do update set name = excluded.name, description = excluded.description, is_core = excluded.is_core, sort_order = excluded.sort_order;

insert into public.company_modules (company_id, module_code, status, enabled_at, settings)
select c.id, 'planning_core', 'active', timezone('utc', now()), '{}'::jsonb
from public.companies c
on conflict (company_id, module_code) do update set status = excluded.status, enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at);

drop trigger if exists trg_planning_runs_updated_at on public.planning_runs;
create trigger trg_planning_runs_updated_at before update on public.planning_runs
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_planning_drafts_updated_at on public.planning_drafts;
create trigger trg_planning_drafts_updated_at before update on public.planning_drafts
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_planning_draft_items_updated_at on public.planning_draft_items;
create trigger trg_planning_draft_items_updated_at before update on public.planning_draft_items
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_task_assignments_updated_at on public.task_assignments;
create trigger trg_task_assignments_updated_at before update on public.task_assignments
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_planning_scoring_weights_updated_at on public.planning_scoring_weights;
create trigger trg_planning_scoring_weights_updated_at before update on public.planning_scoring_weights
for each row execute procedure public.set_updated_at();

alter table public.planning_runs enable row level security;
alter table public.planning_drafts enable row level security;
alter table public.planning_draft_items enable row level security;
alter table public.task_assignments enable row level security;
alter table public.assignment_candidates enable row level security;
alter table public.candidate_score_breakdown enable row level security;
alter table public.planning_conflicts enable row level security;
alter table public.planning_conflict_resolutions enable row level security;
alter table public.planning_publications enable row level security;
alter table public.planning_scoring_weights enable row level security;

drop policy if exists planning_runs_company_all on public.planning_runs;
create policy planning_runs_company_all on public.planning_runs
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists planning_drafts_company_all on public.planning_drafts;
create policy planning_drafts_company_all on public.planning_drafts
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists planning_draft_items_company_all on public.planning_draft_items;
create policy planning_draft_items_company_all on public.planning_draft_items
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists task_assignments_company_all on public.task_assignments;
create policy task_assignments_company_all on public.task_assignments
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists assignment_candidates_company_all on public.assignment_candidates;
create policy assignment_candidates_company_all on public.assignment_candidates
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists candidate_score_breakdown_company_all on public.candidate_score_breakdown;
create policy candidate_score_breakdown_company_all on public.candidate_score_breakdown
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists planning_conflicts_company_all on public.planning_conflicts;
create policy planning_conflicts_company_all on public.planning_conflicts
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists planning_conflict_resolutions_company_all on public.planning_conflict_resolutions;
create policy planning_conflict_resolutions_company_all on public.planning_conflict_resolutions
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists planning_publications_company_all on public.planning_publications;
create policy planning_publications_company_all on public.planning_publications
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists planning_scoring_weights_select on public.planning_scoring_weights;
create policy planning_scoring_weights_select on public.planning_scoring_weights
for select using (scope = 'system' or public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)));

drop policy if exists planning_scoring_weights_company_write on public.planning_scoring_weights;
create policy planning_scoring_weights_company_write on public.planning_scoring_weights
for all using (public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)))
with check (public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)));
