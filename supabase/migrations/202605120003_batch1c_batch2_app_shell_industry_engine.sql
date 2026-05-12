-- Coordiqo Batch 1C + Batch 2
-- App shell support, industry engine, module activation, and flexible entity type foundation.

create table if not exists public.industry_types (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.operational_models (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_modules (
  code text primary key,
  name text not null,
  description text,
  is_core boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.company_modules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  module_code text not null references public.platform_modules(code) on delete cascade,
  status text not null default 'active' check (status in ('active', 'planned', 'disabled')),
  settings jsonb not null default '{}'::jsonb,
  enabled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(company_id, module_code)
);

create table if not exists public.ui_label_sets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  industry_code text references public.industry_types(code) on delete set null,
  code text not null,
  labels jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(company_id, code)
);

create table if not exists public.industry_entity_presets (
  id uuid primary key default gen_random_uuid(),
  industry_code text not null references public.industry_types(code) on delete cascade,
  entity_code text not null,
  label_singular text not null,
  label_plural text not null,
  description text,
  icon text,
  default_fields jsonb not null default '[]'::jsonb,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(industry_code, entity_code)
);

create table if not exists public.entity_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  label_singular text not null,
  label_plural text not null,
  description text,
  source text not null default 'company' check (source in ('industry_preset', 'company')),
  source_preset_id uuid references public.industry_entity_presets(id) on delete set null,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(company_id, code)
);

create table if not exists public.entity_type_fields (
  id uuid primary key default gen_random_uuid(),
  entity_type_id uuid not null references public.entity_types(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null default 'text',
  is_required boolean not null default false,
  is_sensitive boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  sort_order int not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(entity_type_id, field_key)
);

create table if not exists public.company_feature_flags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  flag_key text not null,
  is_enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(company_id, flag_key)
);

insert into public.industry_types (code, name, description, sort_order) values
  ('home_care', 'Hemtjänst', 'Planering för vårdtagare, insatser, kontinuitet och kompetenskrav.', 10),
  ('healthcare', 'Vård och hemsjukvård', 'Patientbesök, legitimationer, medicinska uppdrag och dokumentation.', 20),
  ('cleaning', 'Städ', 'Objekt, städuppdrag, återkommande rutter och checklistor.', 30),
  ('property', 'Fastighet och hyresvärd', 'Fastigheter, lägenheter, hyresgäster, felanmälan och drift.', 40),
  ('construction', 'Bygg', 'Projekt, arbetsytor, team, moment, resurser och beroenden.', 50),
  ('parking', 'Parkeringsövervakning', 'Zoner, patruller, kontrollpunkter och incidenter.', 60),
  ('staffing', 'Bemanning', 'Kundplatser, pass, kandidater, kravprofiler och tillgänglighet.', 70),
  ('field_service', 'Tekniker och service', 'Servicepunkter, arbetsorder, tekniker, utrustning och SLA.', 80),
  ('security', 'Bevakning', 'Patruller, objekt, rondpunkter, avvikelser och jourflöden.', 90),
  ('other', 'Annan verksamhet', 'Flexibel grund för andra fältteam och operationsflöden.', 100)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

insert into public.operational_models (code, name, description, sort_order) values
  ('route_based', 'Ruttbaserad', 'Arbetet optimeras i sekvenser med restid och stopp.', 10),
  ('area_based', 'Områdesbaserad', 'Arbetet delas upp per distrikt, zon eller geografiskt ansvar.', 20),
  ('object_based', 'Objektbaserad', 'Arbetet organiseras runt objekt som fastigheter, kunder eller anläggningar.', 30),
  ('case_based', 'Ärendebaserad', 'Arbetet drivs av ärenden, felanmälningar eller service requests.', 40),
  ('calendar_based', 'Kalenderbaserad', 'Arbetet styrs av bokningar och pass i kalenderliknande vyer.', 50),
  ('patrol_based', 'Patrullbaserad', 'Arbetet består av patruller, ronder och kontrollpunkter.', 60),
  ('team_based', 'Teambaserad', 'Arbetet planeras per team, skift och ansvar.', 70),
  ('project_based', 'Projektbaserad', 'Arbetet sker i projekt, faser och beroenden.', 80),
  ('on_call', 'Jourbaserad', 'Arbetet bygger på beredskap, akuta händelser och snabb omplanering.', 90)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

insert into public.platform_modules (code, name, description, is_core, sort_order) values
  ('foundation', 'Plattformsgrund', 'Auth, företag, roller, team och tenant-isolering.', true, 10),
  ('industry_engine', 'Branschmotor', 'Styr bransch, operativ modell, moduler och objektpresets.', true, 20),
  ('entities', 'Objektregister', 'Flexibel modell för kunder, platser, fastigheter, patienter och andra objekt.', false, 30),
  ('tasks', 'Uppdrag och arbetsorder', 'Ärenden, besök, arbetsorder och statusflöden.', false, 40),
  ('planning', 'Planering', 'Tilldelning, dagplan och senare optimering.', false, 50),
  ('mobile_staff', 'Mobil personalvy', 'Dagens rutt, check-in/out och utförande i fält.', false, 60)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_core = excluded.is_core,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

insert into public.industry_entity_presets (industry_code, entity_code, label_singular, label_plural, description, sort_order) values
  ('property', 'property', 'Fastighet', 'Fastigheter', 'Byggnader, områden och fastighetsobjekt.', 10),
  ('property', 'unit', 'Lägenhet/lokal', 'Lägenheter och lokaler', 'Uthyrningsbara enheter, lokaler, förråd och parkeringsplatser.', 20),
  ('property', 'tenant', 'Hyresgäst', 'Hyresgäster', 'Personer eller företag som hyr en enhet.', 30),
  ('property', 'service_point', 'Servicepunkt', 'Servicepunkter', 'Tekniska utrymmen, installationer och driftpunkter.', 40),
  ('home_care', 'care_recipient', 'Vårdtagare', 'Vårdtagare', 'Personer som tar emot insatser eller besök.', 10),
  ('home_care', 'home', 'Bostad', 'Bostäder', 'Adresser där insatser utförs.', 20),
  ('healthcare', 'patient', 'Patient', 'Patienter', 'Personer som tar emot vårdbesök.', 10),
  ('cleaning', 'cleaning_object', 'Städobjekt', 'Städobjekt', 'Kontor, bostäder, trapphus och andra städytor.', 10),
  ('construction', 'project', 'Byggprojekt', 'Byggprojekt', 'Projekt, etapper och arbetsplatser.', 10),
  ('construction', 'work_area', 'Arbetsyta', 'Arbetsytor', 'Delar av projektet där team utför moment.', 20),
  ('parking', 'parking_zone', 'Parkeringszon', 'Parkeringszoner', 'Zoner och kontrollområden för patrullering.', 10),
  ('staffing', 'customer_site', 'Kundplats', 'Kundplatser', 'Platser och verksamheter där pass bemannas.', 10),
  ('staffing', 'candidate', 'Kandidat', 'Kandidater', 'Personer som kan matchas mot pass och uppdrag.', 20),
  ('field_service', 'service_customer', 'Servicekund', 'Servicekunder', 'Kunder, anläggningar eller servicepunkter.', 10),
  ('field_service', 'asset', 'Tekniskt objekt', 'Tekniska objekt', 'Maskiner, installationer eller utrustning som kräver service.', 20),
  ('security', 'guard_object', 'Bevakningsobjekt', 'Bevakningsobjekt', 'Objekt, platser och rondpunkter för bevakning.', 10),
  ('other', 'object', 'Objekt', 'Objekt', 'Generellt objekt för verksamhetens arbete.', 10)
on conflict (industry_code, entity_code) do update set
  label_singular = excluded.label_singular,
  label_plural = excluded.label_plural,
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
    (target_company_id, 'entities', 'planned', null),
    (target_company_id, 'tasks', 'planned', null),
    (target_company_id, 'planning', 'planned', null),
    (target_company_id, 'mobile_staff', 'planned', null)
  on conflict (company_id, module_code) do nothing;

  update public.company_settings
  set active_modules = array(
    select distinct unnest(coalesce(active_modules, '{}'::text[]) || array['foundation', 'industry_engine'])
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
      company_id,
      code,
      label_singular,
      label_plural,
      description,
      source,
      source_preset_id,
      is_active,
      sort_order
    )
    values (
      target_company_id,
      v_preset.entity_code,
      v_preset.label_singular,
      v_preset.label_plural,
      v_preset.description,
      'industry_preset',
      v_preset.id,
      true,
      v_preset.sort_order
    )
    on conflict (company_id, code) do nothing;
  end loop;
end;
$$;

do $$
declare
  v_company record;
begin
  for v_company in select id from public.companies loop
    perform public.ensure_company_industry_defaults(v_company.id);
  end loop;
end;
$$;

drop trigger if exists trg_industry_types_updated_at on public.industry_types;
create trigger trg_industry_types_updated_at before update on public.industry_types
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_operational_models_updated_at on public.operational_models;
create trigger trg_operational_models_updated_at before update on public.operational_models
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_platform_modules_updated_at on public.platform_modules;
create trigger trg_platform_modules_updated_at before update on public.platform_modules
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_company_modules_updated_at on public.company_modules;
create trigger trg_company_modules_updated_at before update on public.company_modules
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_ui_label_sets_updated_at on public.ui_label_sets;
create trigger trg_ui_label_sets_updated_at before update on public.ui_label_sets
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_industry_entity_presets_updated_at on public.industry_entity_presets;
create trigger trg_industry_entity_presets_updated_at before update on public.industry_entity_presets
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_entity_types_updated_at on public.entity_types;
create trigger trg_entity_types_updated_at before update on public.entity_types
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_entity_type_fields_updated_at on public.entity_type_fields;
create trigger trg_entity_type_fields_updated_at before update on public.entity_type_fields
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_company_feature_flags_updated_at on public.company_feature_flags;
create trigger trg_company_feature_flags_updated_at before update on public.company_feature_flags
for each row execute procedure public.set_updated_at();

alter table public.industry_types enable row level security;
alter table public.operational_models enable row level security;
alter table public.platform_modules enable row level security;
alter table public.company_modules enable row level security;
alter table public.ui_label_sets enable row level security;
alter table public.industry_entity_presets enable row level security;
alter table public.entity_types enable row level security;
alter table public.entity_type_fields enable row level security;
alter table public.company_feature_flags enable row level security;

drop policy if exists "industry types are readable" on public.industry_types;
create policy "industry types are readable"
on public.industry_types for select
using (true);

drop policy if exists "operational models are readable" on public.operational_models;
create policy "operational models are readable"
on public.operational_models for select
using (true);

drop policy if exists "platform modules are readable" on public.platform_modules;
create policy "platform modules are readable"
on public.platform_modules for select
using (true);

drop policy if exists "industry presets are readable" on public.industry_entity_presets;
create policy "industry presets are readable"
on public.industry_entity_presets for select
using (true);

drop policy if exists "company modules visible to members" on public.company_modules;
create policy "company modules visible to members"
on public.company_modules for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "company admins manage modules" on public.company_modules;
create policy "company admins manage modules"
on public.company_modules for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));

drop policy if exists "ui labels visible to company members" on public.ui_label_sets;
create policy "ui labels visible to company members"
on public.ui_label_sets for select
using (company_id is null or public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "company admins manage ui labels" on public.ui_label_sets;
create policy "company admins manage ui labels"
on public.ui_label_sets for all
using (company_id is null or public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'))
with check (company_id is null or public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));

drop policy if exists "entity types visible to company members" on public.entity_types;
create policy "entity types visible to company members"
on public.entity_types for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "company admins manage entity types" on public.entity_types;
create policy "company admins manage entity types"
on public.entity_types for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));

drop policy if exists "entity type fields visible to company members" on public.entity_type_fields;
create policy "entity type fields visible to company members"
on public.entity_type_fields for select
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.entity_types et
    where et.id = entity_type_id
      and public.is_company_member(et.company_id)
  )
);

drop policy if exists "company admins manage entity type fields" on public.entity_type_fields;
create policy "company admins manage entity type fields"
on public.entity_type_fields for all
using (
  public.is_platform_admin()
  or exists (
    select 1 from public.entity_types et
    where et.id = entity_type_id
      and public.has_company_role(et.company_id, 'company_admin')
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1 from public.entity_types et
    where et.id = entity_type_id
      and public.has_company_role(et.company_id, 'company_admin')
  )
);

drop policy if exists "feature flags visible to company members" on public.company_feature_flags;
create policy "feature flags visible to company members"
on public.company_feature_flags for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "company admins manage feature flags" on public.company_feature_flags;
create policy "company admins manage feature flags"
on public.company_feature_flags for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));

grant execute on function public.ensure_company_industry_defaults(uuid) to authenticated;

create or replace function public.bootstrap_company_for_current_user(
  p_company_name text,
  p_org_number text default null,
  p_industry_type text default 'other',
  p_operational_model text default 'object_based',
  p_timezone text default 'Europe/Stockholm',
  p_default_team_name text default 'Huvudteam'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_membership_id uuid;
  v_company_id uuid;
  v_membership_id uuid;
  v_team_id uuid;
  v_slug_base text;
  v_slug text;
  v_suffix int := 0;
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

  select cm.id
    into v_existing_membership_id
  from public.company_memberships cm
  where cm.user_id = v_user_id
    and cm.status = 'active'
  limit 1;

  if v_existing_membership_id is not null then
    raise exception 'User already has an active company membership';
  end if;

  v_slug_base := public.slugify_text(p_company_name);
  v_slug := v_slug_base;

  while exists(select 1 from public.companies c where c.slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_slug_base || '-' || v_suffix::text;
  end loop;

  insert into public.companies (
    name,
    slug,
    org_number,
    status,
    industry_type,
    operational_model,
    timezone,
    language_code
  )
  values (
    trim(p_company_name),
    v_slug,
    nullif(trim(coalesce(p_org_number, '')), ''),
    'active',
    coalesce(nullif(trim(coalesce(p_industry_type, '')), ''), 'other'),
    coalesce(nullif(trim(coalesce(p_operational_model, '')), ''), 'object_based'),
    coalesce(nullif(trim(coalesce(p_timezone, '')), ''), 'Europe/Stockholm'),
    'sv'
  )
  returning id into v_company_id;

  insert into public.company_settings (
    company_id,
    active_modules,
    ui_label_set,
    default_maps_provider,
    allow_impersonation
  )
  values (
    v_company_id,
    array['foundation', 'industry_engine'],
    coalesce(nullif(trim(coalesce(p_industry_type, '')), ''), 'other'),
    'google_maps',
    false
  )
  on conflict (company_id) do update set
    active_modules = array(
      select distinct unnest(coalesce(public.company_settings.active_modules, '{}'::text[]) || excluded.active_modules)
    ),
    ui_label_set = excluded.ui_label_set,
    updated_at = timezone('utc', now());

  update public.company_memberships
  set is_default = false
  where user_id = v_user_id;

  insert into public.company_memberships (
    company_id,
    user_id,
    role,
    status,
    is_default,
    invited_by
  )
  values (
    v_company_id,
    v_user_id,
    'company_admin',
    'active',
    true,
    v_user_id
  )
  returning id into v_membership_id;

  insert into public.teams (
    company_id,
    name,
    code,
    description,
    status
  )
  values (
    v_company_id,
    coalesce(nullif(trim(coalesce(p_default_team_name, '')), ''), 'Huvudteam'),
    'MAIN',
    'Första teamet som skapades automatiskt under onboarding.',
    'active'
  )
  returning id into v_team_id;

  insert into public.team_memberships (
    team_id,
    membership_id,
    is_primary
  )
  values (
    v_team_id,
    v_membership_id,
    true
  )
  on conflict (team_id, membership_id) do nothing;

  perform public.ensure_company_industry_defaults(v_company_id);

  insert into public.audit_logs (
    company_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_company_id,
    v_user_id,
    'company_bootstrap_completed',
    'company',
    v_company_id::text,
    jsonb_build_object(
      'industry_type', p_industry_type,
      'operational_model', p_operational_model,
      'team_id', v_team_id,
      'source', 'self_serve_onboarding',
      'modules', array['foundation', 'industry_engine']
    )
  );

  return v_company_id;
end;
$$;

grant execute on function public.bootstrap_company_for_current_user(text, text, text, text, text, text) to authenticated;
