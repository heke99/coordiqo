-- Coordiqo import, UX and pilot hardening suite.
-- Safe/idempotent. Adds import templates, source tracking, checklist templates, AI suggestion view and QA runs.

create extension if not exists pgcrypto;

alter table if exists public.staff_profiles add column if not exists import_run_id uuid references public.import_runs(id) on delete set null;
alter table if exists public.resource_assets add column if not exists import_run_id uuid references public.import_runs(id) on delete set null;
alter table if exists public.entities add column if not exists import_run_id uuid references public.import_runs(id) on delete set null;
alter table if exists public.tasks add column if not exists import_run_id uuid references public.import_runs(id) on delete set null;
alter table if exists public.projects add column if not exists import_run_id uuid references public.import_runs(id) on delete set null;

create index if not exists staff_profiles_import_run_idx on public.staff_profiles(company_id, import_run_id) where import_run_id is not null;
create index if not exists resource_assets_import_run_idx on public.resource_assets(company_id, import_run_id) where import_run_id is not null;
create index if not exists entities_import_run_idx on public.entities(company_id, import_run_id) where import_run_id is not null;
create index if not exists tasks_import_run_idx on public.tasks(company_id, import_run_id) where import_run_id is not null;
create index if not exists projects_import_run_idx on public.projects(company_id, import_run_id) where import_run_id is not null;

create table if not exists public.import_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  scope text not null default 'company' check (scope in ('system', 'company')),
  import_type text not null check (import_type in ('staff', 'resources', 'entities', 'tasks', 'projects')),
  name text not null,
  description text,
  columns jsonb not null default '[]'::jsonb,
  sample_text text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint import_templates_scope_company_check check ((scope = 'system' and company_id is null) or (scope = 'company' and company_id is not null))
);

create unique index if not exists import_templates_unique_idx
on public.import_templates(scope, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), import_type, lower(name))
where archived_at is null;

create table if not exists public.mobile_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  scope text not null default 'company' check (scope in ('system', 'company')),
  checklist_key text not null,
  name text not null,
  applies_to text not null default 'task',
  industry_type text,
  items jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint mobile_checklist_templates_scope_company_check check ((scope = 'system' and company_id is null) or (scope = 'company' and company_id is not null))
);

create unique index if not exists mobile_checklist_templates_unique_idx
on public.mobile_checklist_templates(scope, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), checklist_key)
where archived_at is null;

create table if not exists public.qa_test_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  scope text not null default 'company' check (scope in ('system', 'company')),
  name text not null,
  status text not null default 'planned' check (status in ('planned', 'running', 'passed', 'failed', 'skipped')),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  archived_at timestamptz,
  constraint qa_test_runs_scope_company_check check ((scope = 'system' and company_id is null) or (scope = 'company' and company_id is not null))
);

create table if not exists public.qa_test_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  qa_test_run_id uuid references public.qa_test_runs(id) on delete cascade,
  item_key text not null,
  title text not null,
  description text,
  status text not null default 'planned' check (status in ('planned', 'passed', 'failed', 'skipped')),
  evidence text,
  sort_order integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create index if not exists import_templates_company_idx on public.import_templates(company_id, import_type) where archived_at is null;
create index if not exists mobile_checklist_templates_company_idx on public.mobile_checklist_templates(company_id, checklist_key) where archived_at is null;
create index if not exists qa_test_runs_company_idx on public.qa_test_runs(company_id, status) where archived_at is null;
create index if not exists qa_test_items_run_idx on public.qa_test_items(qa_test_run_id, sort_order) where archived_at is null;

drop trigger if exists trg_import_templates_updated_at on public.import_templates;
create trigger trg_import_templates_updated_at before update on public.import_templates for each row execute procedure public.set_updated_at();
drop trigger if exists trg_mobile_checklist_templates_updated_at on public.mobile_checklist_templates;
create trigger trg_mobile_checklist_templates_updated_at before update on public.mobile_checklist_templates for each row execute procedure public.set_updated_at();
drop trigger if exists trg_qa_test_runs_updated_at on public.qa_test_runs;
create trigger trg_qa_test_runs_updated_at before update on public.qa_test_runs for each row execute procedure public.set_updated_at();
drop trigger if exists trg_qa_test_items_updated_at on public.qa_test_items;
create trigger trg_qa_test_items_updated_at before update on public.qa_test_items for each row execute procedure public.set_updated_at();

alter table public.import_templates enable row level security;
alter table public.mobile_checklist_templates enable row level security;
alter table public.qa_test_runs enable row level security;
alter table public.qa_test_items enable row level security;

drop policy if exists import_templates_select on public.import_templates;
create policy import_templates_select on public.import_templates for select
using (scope = 'system' or public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)));
drop policy if exists import_templates_write on public.import_templates;
create policy import_templates_write on public.import_templates for all
using (public.is_platform_admin() or (company_id is not null and public.has_company_role(company_id, 'operations_manager')))
with check (public.is_platform_admin() or (company_id is not null and public.has_company_role(company_id, 'operations_manager')));

drop policy if exists mobile_checklist_templates_select on public.mobile_checklist_templates;
create policy mobile_checklist_templates_select on public.mobile_checklist_templates for select
using (scope = 'system' or public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)));
drop policy if exists mobile_checklist_templates_write on public.mobile_checklist_templates;
create policy mobile_checklist_templates_write on public.mobile_checklist_templates for all
using (public.is_platform_admin() or (company_id is not null and public.has_company_role(company_id, 'operations_manager')))
with check (public.is_platform_admin() or (company_id is not null and public.has_company_role(company_id, 'operations_manager')));

drop policy if exists qa_test_runs_select on public.qa_test_runs;
create policy qa_test_runs_select on public.qa_test_runs for select
using (scope = 'system' or public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)));
drop policy if exists qa_test_runs_write on public.qa_test_runs;
create policy qa_test_runs_write on public.qa_test_runs for all
using (public.is_platform_admin() or (company_id is not null and public.has_company_role(company_id, 'operations_manager')))
with check (public.is_platform_admin() or (company_id is not null and public.has_company_role(company_id, 'operations_manager')));

drop policy if exists qa_test_items_select on public.qa_test_items;
create policy qa_test_items_select on public.qa_test_items for select
using (public.is_platform_admin() or (company_id is null and exists (select 1 from public.qa_test_runs q where q.id = qa_test_run_id and q.scope = 'system')) or (company_id is not null and public.is_company_member(company_id)));
drop policy if exists qa_test_items_write on public.qa_test_items;
create policy qa_test_items_write on public.qa_test_items for all
using (public.is_platform_admin() or (company_id is not null and public.has_company_role(company_id, 'operations_manager')))
with check (public.is_platform_admin() or (company_id is not null and public.has_company_role(company_id, 'operations_manager')));

insert into public.import_templates (scope, company_id, import_type, name, description, columns, sample_text)
values
  ('system', null, 'staff', 'Personalimport', 'Klistra in namn, e-post, telefon, team och roll från Excel eller CSV.', '["full_name","email","phone","team","job_title"]', 'full_name,email,phone,team,job_title
Anna Andersson,anna@example.com,+46700000001,Malmö,Chaufför'),
  ('system', null, 'resources', 'Resursimport', 'Importera fordon, nycklar, verktyg och utrustning.', '["name","asset_tag","resource_type","status","location_label"]', 'name,asset_tag,resource_type,status,location_label
Bil 1,CAR-1,Bil,available,Malmö'),
  ('system', null, 'entities', 'Objektimport', 'Importera kunder, objekt, patienter eller platser.', '["name","external_id","summary","team"]', 'name,external_id,summary,team
Kund A,K-001,Startkund,Malmö'),
  ('system', null, 'tasks', 'Uppdragsimport', 'Importera uppdrag med titel, status, prioritet och plats.', '["title","status","priority","location_label","duration_minutes"]', 'title,status,priority,location_label,duration_minutes
Leverans 1,open,normal,Malmö,45'),
  ('system', null, 'projects', 'Projektimport', 'Importera enkla projekt med namn, typ, budget och deadline.', '["name","project_type","priority","budget_amount","deadline_date"]', 'name,project_type,priority,budget_amount,deadline_date
Renovering A,custom,normal,100000,2026-07-01')
on conflict do nothing;

insert into public.mobile_checklist_templates (scope, company_id, checklist_key, name, applies_to, industry_type, items)
values
  ('system', null, 'default_task_completion', 'Standard uppdragskontroll', 'task', null, '[{"key":"arrived","label":"Jag är på plats","type":"boolean"},{"key":"work_done","label":"Arbetet är utfört","type":"boolean"},{"key":"deviation","label":"Avvikelse finns","type":"boolean"}]'),
  ('system', null, 'courier_delivery', 'Leveranskontroll', 'task', 'courier', '[{"key":"picked_up","label":"Gods hämtat","type":"boolean"},{"key":"delivered","label":"Gods levererat","type":"boolean"},{"key":"recipient","label":"Mottagare","type":"text"}]'),
  ('system', null, 'cleaning_quality', 'Städkontroll', 'task', 'cleaning', '[{"key":"rooms_done","label":"Alla ytor klara","type":"boolean"},{"key":"materials","label":"Material påfyllt","type":"boolean"},{"key":"photo_needed","label":"Foto behövs","type":"boolean"}]')
on conflict do nothing;

with run as (
  insert into public.qa_test_runs (scope, company_id, name, status, summary)
  values ('system', null, 'Coordiqo pilot readiness checklist', 'planned', '{"source":"system_seed"}')
  on conflict do nothing
  returning id
), target_run as (
  select id from run
  union all
  select id from public.qa_test_runs where scope = 'system' and name = 'Coordiqo pilot readiness checklist' limit 1
)
insert into public.qa_test_items (qa_test_run_id, item_key, title, description, sort_order)
select tr.id, item_key, title, description, sort_order
from target_run tr
cross join (values
  ('demo_request', 'Demo request saves lead', 'Public request form saves lead and sends internal notification.', 10),
  ('tenant_isolation', 'Tenant isolation', 'Verify users cannot read another company data.', 20),
  ('role_permissions', 'Role permissions', 'Verify company roles see the correct surfaces.', 30),
  ('import_staff', 'Import staff', 'Paste or upload staff rows and validate duplicates/errors.', 40),
  ('mobile_complete', 'Mobile completion', 'Staff completes a task from mobile view.', 50),
  ('routing_optimization', 'Routing and optimization', 'Run GraphHopper/VROOM backed planning and inspect fallback behavior.', 60),
  ('ai_approval', 'AI approval flow', 'AI suggestion is reviewed by a human before sensitive action.', 70),
  ('billing_underlay', 'Billing underlay', 'Create report and invoice underlay for a period.', 80)
) as v(item_key, title, description, sort_order)
on conflict do nothing;

create or replace view public.coordiqo_import_readiness_v
with (security_invoker = true)
as
select
  c.id as company_id,
  c.name as company_name,
  (select count(*) from public.import_runs ir where ir.company_id = c.id and ir.archived_at is null) as import_runs,
  (select count(*) from public.import_run_items iri where iri.company_id = c.id and iri.status = 'failed' and iri.archived_at is null) as failed_import_rows,
  (select count(*) from public.import_templates it where it.scope = 'system' or it.company_id = c.id) as available_templates,
  case
    when (select count(*) from public.import_templates it where it.scope = 'system' or it.company_id = c.id) = 0 then 'missing_templates'
    else 'ready'
  end as readiness_status
from public.companies c;

