-- Batch 3: Planning Rules Engine 2.0
-- Adds publish-safe override metadata, risk counters and rule summary fields.
-- Safe/idempotent. Does not delete operational data.

alter table if exists public.planning_draft_items
  add column if not exists risk_score numeric not null default 0,
  add column if not exists blocking_count integer not null default 0,
  add column if not exists warning_count integer not null default 0,
  add column if not exists info_count integer not null default 0,
  add column if not exists conflict_override_approved boolean not null default false,
  add column if not exists override_reason text,
  add column if not exists override_approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists override_approved_at timestamptz,
  add column if not exists rule_summary jsonb not null default '{}'::jsonb;

alter table if exists public.task_assignments
  add column if not exists risk_score numeric not null default 0,
  add column if not exists blocking_count integer not null default 0,
  add column if not exists warning_count integer not null default 0,
  add column if not exists info_count integer not null default 0,
  add column if not exists override_approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists override_approved_at timestamptz,
  add column if not exists rule_summary jsonb not null default '{}'::jsonb;

alter table if exists public.assignment_candidates
  add column if not exists risk_score numeric not null default 0,
  add column if not exists blocking_count integer not null default 0,
  add column if not exists warning_count integer not null default 0,
  add column if not exists info_count integer not null default 0,
  add column if not exists rule_summary jsonb not null default '{}'::jsonb;

alter table if exists public.planning_conflicts
  add column if not exists resolution_reason text,
  add column if not exists resolution_metadata jsonb not null default '{}'::jsonb;

alter table if exists public.planning_conflict_resolutions
  add column if not exists planning_draft_item_id uuid references public.planning_draft_items(id) on delete cascade,
  add column if not exists task_assignment_id uuid references public.task_assignments(id) on delete cascade,
  add column if not exists action_source text not null default 'manual';

-- Allow batch-level or draft-item-level override resolutions without a single conflict_id.
do $$
begin
  if to_regclass('public.planning_conflict_resolutions') is not null then
    begin
      alter table public.planning_conflict_resolutions alter column conflict_id drop not null;
    exception
      when undefined_column then null;
    end;
  end if;
end $$;

-- Backfill counters from existing open/overridden conflicts where possible.
do $$
begin
  if to_regclass('public.planning_draft_items') is not null and to_regclass('public.planning_conflicts') is not null then
    with counts as (
      select
        planning_draft_item_id,
        count(*) filter (where severity in ('hard', 'critical', 'blocked'))::integer as blocking_count,
        count(*) filter (where severity in ('soft', 'warning'))::integer as warning_count,
        count(*) filter (where severity = 'info')::integer as info_count
      from public.planning_conflicts
      where planning_draft_item_id is not null
        and archived_at is null
        and status in ('open', 'overridden')
      group by planning_draft_item_id
    )
    update public.planning_draft_items pdi
       set blocking_count = counts.blocking_count,
           warning_count = counts.warning_count,
           info_count = counts.info_count,
           risk_score = least(100, greatest(0, counts.blocking_count * 35 + counts.warning_count * 12 + counts.info_count * 4)),
           rule_summary = jsonb_build_object(
             'blockingCount', counts.blocking_count,
             'warningCount', counts.warning_count,
             'infoCount', counts.info_count,
             'source', 'batch3_backfill'
           )
      from counts
     where pdi.id = counts.planning_draft_item_id;
  end if;
end $$;

create index if not exists planning_draft_items_override_review_idx
  on public.planning_draft_items(company_id, conflict_override_approved, conflict_level, status)
  where archived_at is null;

create index if not exists planning_draft_items_risk_idx
  on public.planning_draft_items(company_id, risk_score desc, blocking_count desc, warning_count desc)
  where archived_at is null;

create index if not exists task_assignments_override_review_idx
  on public.task_assignments(company_id, conflict_override_approved, risk_score desc)
  where archived_at is null;

create index if not exists planning_conflict_resolutions_draft_item_idx
  on public.planning_conflict_resolutions(company_id, planning_draft_item_id, resolution_type, created_at desc)
  where planning_draft_item_id is not null;

create or replace view public.coordiqo_planning_rules_readiness_v as
select
  c.id as company_id,
  c.name as company_name,
  count(distinct pdi.id) as draft_items,
  count(distinct pdi.id) filter (where pdi.blocking_count > 0) as draft_items_with_blockers,
  count(distinct pdi.id) filter (where pdi.warning_count > 0) as draft_items_with_warnings,
  count(distinct pdi.id) filter (where pdi.conflict_override_approved = true) as draft_items_with_override,
  count(distinct ta.id) filter (where ta.conflict_override_approved = true) as assignments_with_override,
  count(distinct pc.id) filter (where pc.status = 'open') as open_conflicts,
  count(distinct pc.id) filter (where pc.status = 'overridden') as overridden_conflicts,
  coalesce(max(pdi.updated_at), max(c.updated_at), max(c.created_at)) as last_activity_at
from public.companies c
left join public.planning_draft_items pdi on pdi.company_id = c.id and pdi.archived_at is null
left join public.task_assignments ta on ta.company_id = c.id and ta.archived_at is null
left join public.planning_conflicts pc on pc.company_id = c.id and pc.archived_at is null
group by c.id, c.name;
