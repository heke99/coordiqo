-- Batch 6: Kompetenser, certifikat och regelmotor v1
-- Körs efter batch 5/pre-batch6 migrationerna.

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  category text not null default 'general',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(company_id, code)
);

create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  category text not null default 'general',
  requires_expiry boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(company_id, code)
);

create table if not exists public.staff_skills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  level text not null default 'qualified',
  source text not null default 'manual',
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(staff_profile_id, skill_id)
);

create table if not exists public.staff_certifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  certification_id uuid not null references public.certifications(id) on delete cascade,
  certificate_number text,
  status text not null default 'valid',
  issued_at date,
  expires_at date,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(staff_profile_id, certification_id)
);

create table if not exists public.task_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  task_type_id uuid references public.task_types(id) on delete cascade,
  requirement_kind text not null check (requirement_kind in ('skill', 'certification', 'staff_role', 'transport_mode', 'double_staffing', 'continuity', 'custom')),
  skill_id uuid references public.skills(id) on delete cascade,
  certification_id uuid references public.certifications(id) on delete cascade,
  required_value text,
  minimum_level text,
  is_hard_requirement boolean not null default true,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint task_requirements_target_check check (task_id is not null or task_type_id is not null)
);

create table if not exists public.assignment_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  rule_key text not null,
  scope text not null default 'company',
  severity text not null default 'hard' check (severity in ('hard', 'soft', 'info')),
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(company_id, rule_key)
);

create table if not exists public.rule_violations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  staff_profile_id uuid references public.staff_profiles(id) on delete cascade,
  assignment_rule_id uuid references public.assignment_rules(id) on delete set null,
  task_requirement_id uuid references public.task_requirements(id) on delete set null,
  severity text not null default 'hard',
  status text not null default 'open',
  violation_code text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_skills_company_active on public.skills(company_id, is_active) where archived_at is null;
create index if not exists idx_certifications_company_active on public.certifications(company_id, is_active) where archived_at is null;
create index if not exists idx_staff_skills_staff on public.staff_skills(staff_profile_id) where archived_at is null;
create index if not exists idx_staff_certifications_staff on public.staff_certifications(staff_profile_id) where archived_at is null;
create index if not exists idx_task_requirements_task on public.task_requirements(task_id) where archived_at is null;
create index if not exists idx_task_requirements_type on public.task_requirements(task_type_id) where archived_at is null;
create index if not exists idx_rule_violations_company_task on public.rule_violations(company_id, task_id, status) where archived_at is null;

alter table public.skills enable row level security;
alter table public.certifications enable row level security;
alter table public.staff_skills enable row level security;
alter table public.staff_certifications enable row level security;
alter table public.task_requirements enable row level security;
alter table public.assignment_rules enable row level security;
alter table public.rule_violations enable row level security;

do $$ begin
  create policy skills_company_member_select on public.skills for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy skills_company_admin_all on public.skills for all using (public.is_platform_admin() or public.is_company_member(company_id)) with check (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy certifications_company_member_select on public.certifications for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy certifications_company_admin_all on public.certifications for all using (public.is_platform_admin() or public.is_company_member(company_id)) with check (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy staff_skills_company_member_select on public.staff_skills for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy staff_skills_company_admin_all on public.staff_skills for all using (public.is_platform_admin() or public.is_company_member(company_id)) with check (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy staff_certifications_company_member_select on public.staff_certifications for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy staff_certifications_company_admin_all on public.staff_certifications for all using (public.is_platform_admin() or public.is_company_member(company_id)) with check (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy task_requirements_company_member_select on public.task_requirements for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy task_requirements_company_admin_all on public.task_requirements for all using (public.is_platform_admin() or public.is_company_member(company_id)) with check (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy assignment_rules_company_member_select on public.assignment_rules for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy assignment_rules_company_admin_all on public.assignment_rules for all using (public.is_platform_admin() or public.is_company_member(company_id)) with check (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy rule_violations_company_member_select on public.rule_violations for select using (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy rule_violations_company_admin_all on public.rule_violations for all using (public.is_platform_admin() or public.is_company_member(company_id)) with check (public.is_platform_admin() or public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

insert into public.platform_modules (code, name, description, is_core, sort_order)
values ('rules_engine', 'Regelmotor', 'Kompetenser, certifikat och matchningsregler.', false, 65)
on conflict (code) do update set name = excluded.name, description = excluded.description, updated_at = now();

insert into public.company_modules (company_id, module_code, status, enabled_at, settings)
select c.id, 'rules_engine', 'active', now(), '{}'::jsonb
from public.companies c
where not exists (
  select 1 from public.company_modules cm where cm.company_id = c.id and cm.module_code = 'rules_engine'
);

insert into public.company_feature_flags (company_id, flag_key, is_enabled, config)
select c.id, 'rule_engine_v1', true, '{}'::jsonb
from public.companies c
where not exists (
  select 1 from public.company_feature_flags f where f.company_id = c.id and f.flag_key = 'rule_engine_v1'
);

-- Basregler per befintligt bolag.
insert into public.assignment_rules (company_id, name, rule_key, scope, severity, description, config)
select c.id, 'Blockera saknad hård kompetens', 'required_skill_must_match', 'company', 'hard', 'Tilldelad personal måste ha hårda kompetenskrav på uppdraget.', '{}'::jsonb
from public.companies c
on conflict (company_id, rule_key) do nothing;

insert into public.assignment_rules (company_id, name, rule_key, scope, severity, description, config)
select c.id, 'Blockera saknat/utgånget certifikat', 'required_certification_must_be_valid', 'company', 'hard', 'Tilldelad personal måste ha giltiga certifikat som uppdraget kräver.', '{}'::jsonb
from public.companies c
on conflict (company_id, rule_key) do nothing;

insert into public.assignment_rules (company_id, name, rule_key, scope, severity, description, config)
select c.id, 'Flagga fel färdsätt', 'transport_mode_should_match', 'company', 'soft', 'Färdsätt bör matcha uppdragets krav när det anges.', '{}'::jsonb
from public.companies c
on conflict (company_id, rule_key) do nothing;

-- Branschstarter. Skapas bara om koden inte redan finns för bolaget.
insert into public.skills (company_id, code, name, category, description)
select c.id, x.code, x.name, x.category, x.description
from public.companies c
cross join lateral (
  values
    ('customer_contact', 'Kundkontakt', 'general', 'Kan hantera kund-/brukarkontakt.'),
    ('key_handling', 'Nyckelhantering', 'security', 'Får hantera nycklar, taggar och access.'),
    ('basic_documentation', 'Dokumentation', 'general', 'Kan dokumentera utfört arbete korrekt.')
) as x(code, name, category, description)
on conflict (company_id, code) do nothing;

insert into public.skills (company_id, code, name, category, description)
select c.id, x.code, x.name, x.category, x.description
from public.companies c
cross join lateral (
  values
    ('property_fault_triage', 'Felanmälan triage', 'property', 'Kan bedöma och prioritera fastighetsfel.'),
    ('inspection', 'Besiktning', 'property', 'Kan utföra besiktning och kontroll.'),
    ('maintenance', 'Underhåll', 'property', 'Kan utföra enklare underhållsåtgärder.')
) as x(code, name, category, description)
where c.industry_type = 'property'
on conflict (company_id, code) do nothing;

insert into public.skills (company_id, code, name, category, description)
select c.id, x.code, x.name, x.category, x.description
from public.companies c
cross join lateral (
  values
    ('personal_care', 'Personlig omsorg', 'care', 'Kan utföra omsorgsinsatser.'),
    ('medication_support', 'Läkemedelsstöd', 'care', 'Kan hantera läkemedelsrelaterade insatser enligt rutin.'),
    ('continuity_care', 'Kontinuitetsarbete', 'care', 'Lämplig för återkommande vårdtagare.')
) as x(code, name, category, description)
where c.industry_type = 'home_care'
on conflict (company_id, code) do nothing;

insert into public.certifications (company_id, code, name, category, description, requires_expiry)
select c.id, x.code, x.name, x.category, x.description, x.requires_expiry
from public.companies c
cross join lateral (
  values
    ('drivers_license_b', 'B-körkort', 'transport', 'Giltigt B-körkort.', true),
    ('id06', 'ID06 / arbetsplats-ID', 'worksite', 'Behörighet för arbetsplats eller entreprenörsmiljö.', true),
    ('background_check', 'Bakgrundskontroll', 'compliance', 'Genomförd kontroll enligt företagets policy.', true)
) as x(code, name, category, description, requires_expiry)
on conflict (company_id, code) do nothing;
