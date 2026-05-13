-- Coordiqo Batch 8E
-- AI planning assistant, request audit trail and planning quality presets.

create extension if not exists pgcrypto;

create table if not exists public.planning_ai_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  prompt text not null,
  interpreted_intent jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  planning_run_id uuid references public.planning_runs(id) on delete set null,
  planning_draft_id uuid references public.planning_drafts(id) on delete set null,
  result_summary jsonb not null default '{}'::jsonb,
  error_message text,
  requested_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'planning_ai_requests_status_check'
      and conrelid = 'public.planning_ai_requests'::regclass
  ) then
    alter table public.planning_ai_requests
      add constraint planning_ai_requests_status_check
      check (status in ('draft', 'running', 'completed', 'failed', 'cancelled'));
  end if;
end $$;

alter table public.planning_runs add column if not exists ai_request_id uuid;
alter table public.planning_drafts add column if not exists ai_request_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'planning_runs_ai_request_fk' and conrelid = 'public.planning_runs'::regclass) then
    alter table public.planning_runs add constraint planning_runs_ai_request_fk foreign key (ai_request_id) references public.planning_ai_requests(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'planning_drafts_ai_request_fk' and conrelid = 'public.planning_drafts'::regclass) then
    alter table public.planning_drafts add constraint planning_drafts_ai_request_fk foreign key (ai_request_id) references public.planning_ai_requests(id) on delete set null;
  end if;
end $$;

create index if not exists idx_planning_ai_requests_company_status on public.planning_ai_requests(company_id, status, created_at desc) where archived_at is null;
create index if not exists idx_planning_ai_requests_run on public.planning_ai_requests(planning_run_id) where archived_at is null;
create index if not exists idx_candidate_score_breakdown_score_key on public.candidate_score_breakdown(company_id, score_key);

insert into public.planning_scoring_weights (scope, company_id, industry_type, score_key, label, points, metadata)
values
  ('system', null, null, 'priority_first', 'Hög prioritet först', 12, '{"batch":"8E"}'::jsonb),
  ('system', null, null, 'minimize_travel', 'Kortare restid/rutt', 15, '{"batch":"8E","llm_priority":"minimize_travel"}'::jsonb),
  ('system', null, null, 'avoid_overtime', 'Undvik övertid', 15, '{"batch":"8E","llm_priority":"avoid_overtime"}'::jsonb),
  ('system', null, null, 'draft_edit_recalculation', 'Omräkning efter draft-redigering', 0, '{"batch":"8E"}'::jsonb)
on conflict do nothing;

insert into public.platform_modules (code, name, description, is_core, sort_order)
values ('ai_planning_assistant', 'AI-planeringsassistent', 'Textstyrd planeringsassistent som skapar planeringsutkast ovanpå regler, kandidater, score och konflikter.', true, 85)
on conflict (code) do update set name = excluded.name, description = excluded.description, is_core = excluded.is_core, sort_order = excluded.sort_order;

insert into public.company_modules (company_id, module_code, status, enabled_at, settings)
select c.id, 'ai_planning_assistant', 'active', timezone('utc', now()), '{"batch":"8E"}'::jsonb
from public.companies c
on conflict (company_id, module_code) do update set status = excluded.status, enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at);

drop trigger if exists trg_planning_ai_requests_updated_at on public.planning_ai_requests;
create trigger trg_planning_ai_requests_updated_at before update on public.planning_ai_requests
for each row execute procedure public.set_updated_at();
