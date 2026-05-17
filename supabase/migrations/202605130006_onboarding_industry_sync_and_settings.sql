-- Batch 8G/8H hardening: onboarding sync, settings entry and non-locking operational model.
-- This migration is safe to run after 8G/8H. It does not remove company data.

insert into public.platform_modules (code, name, description, is_core, sort_order) values
  ('foundation', 'Plattformsgrund', 'Auth, företag, roller, team och tenant-isolering.', true, 10),
  ('industry_engine', 'Branschmotor', 'Styr bransch, operativ modell, moduler och objektpresets.', true, 20),
  ('industry_runtime', 'Branschruntime', 'Aktiva branschlabels, statusar, mobilåtgärder och planeringsregler per företag.', true, 25),
  ('organisation', 'Organisation och behörighet', 'Team, inbjudningar, roller och organisationsstyrning.', true, 28),
  ('entities', 'Objektregister', 'Flexibel modell för kunder, platser, fastigheter, patienter och andra objekt.', true, 30),
  ('entity_configuration', 'Objektkonfiguration', 'Dynamiska objekttyper, fält och relationer.', true, 32),
  ('tasks', 'Uppdrag och arbetsorder', 'Ärenden, uppdrag, arbetsorder, status och kommentarer.', true, 40),
  ('audit_control', 'Audit och support', 'Auditlogg, supportläge och permission overrides.', true, 45),
  ('document_storage', 'Dokumenthantering', 'Privat dokumentlagring för objekt- och uppdragsdokument.', true, 46),
  ('resources', 'Personal och resurser', 'Personalprofiler, fordon, utrustning och organisation.', true, 50),
  ('rules_engine', 'Regelmotor', 'Kompetenser, certifikat och matchningsregler.', true, 60),
  ('operations', 'Operationsvy', 'Daglig kontrollpanel för planering, rutter, resurser, avvikelser och konflikter.', true, 65),
  ('routes', 'Rutter och leveranser', 'Ruttordning, stopp, pickup/dropoff och restidsunderlag.', true, 66),
  ('availability_engine', 'Tillgänglighet och schema', 'Pass, frånvaro, kapacitet och tillgänglighetsmallar.', true, 70),
  ('planning', 'Planering', 'Tilldelning, dagplan och senare optimering.', true, 75),
  ('planning_core', 'Planeringsmotor', 'Planeringskörningar, utkast, kandidater, konflikter och publicering.', true, 80),
  ('planning_templates', 'Planeringsmallar', 'Återanvändbara planeringsutkast, rutter och uppdragsmönster.', true, 82),
  ('project_planning', 'Projektplanering', 'Projektmallar, intake, kalkylregler och projektgenererade uppdrag.', true, 84),
  ('ai_planning_assistant', 'AI-planeringsassistent', 'Textstyrd planeringsassistent som skapar planeringsutkast ovanpå regler, kandidater, score och konflikter.', true, 85),
  ('resource_responsibility', 'Resursansvar', 'Branschneutral resursmotor för krav, planerat ansvar, mobil kvittens, avvikelse och historik.', true, 95),
  ('mobile_staff', 'Mobil personalvy', 'Dagens rutt, resurser, kvittens och utförande i fält.', true, 100)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_core = true,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

create or replace function public.coordiqo_core_module_codes()
returns text[]
language sql
stable
as $$
  select array[
    'foundation',
    'industry_engine',
    'industry_runtime',
    'organisation',
    'entities',
    'entity_configuration',
    'tasks',
    'audit_control',
    'document_storage',
    'resources',
    'rules_engine',
    'operations',
    'routes',
    'availability_engine',
    'planning',
    'planning_core',
    'planning_templates',
    'project_planning',
    'ai_planning_assistant',
    'resource_responsibility',
    'mobile_staff'
  ]::text[];
$$;

create or replace function public.coordiqo_default_task_types(p_industry text)
returns text[]
language sql
stable
as $$
  select case coalesce(p_industry, 'other')
    when 'municipality' then array['Måltidsleverans','Tillsynsbesök','Intern transport','Fastighetsservice','Park/drift','LSS-insats','Skoltransport']::text[]
    when 'courier' then array['Pickup','Delivery','Pickup + dropoff','Retur','Express delivery','Multi-stop route','Schemalagd leverans']::text[]
    when 'home_care' then array['Morgonbesök','Lunchbesök','Kvällsbesök','Tillsyn','Läkemedelspåminnelse','Dubbelbemanning']::text[]
    when 'healthcare' then array['Hembesök','Provtagning','Omläggning','Uppföljning','Akutbesök']::text[]
    when 'cleaning' then array['Kontorsstäd','Trappstäd','Flyttstäd','Byggstäd','Fönsterputs']::text[]
    when 'property' then array['Felanmälan','Besiktning','Låsbyte','Driftkontroll','Underhåll']::text[]
    when 'construction' then array['Rivning','Snickeri','El','VVS','Målning','Besiktning']::text[]
    when 'field_service' then array['Installation','Felsökning','Servicebesök','Akutjobb','Uppföljning']::text[]
    when 'security' then array['Rond','Larmutryckning','Öppning','Stängning','Incident']::text[]
    else array['Besök','Service','Kontroll','Leverans','Projektmoment']::text[]
  end;
$$;

create or replace function public.coordiqo_default_resource_types(p_industry text)
returns text[]
language sql
stable
as $$
  select case coalesce(p_industry, 'other')
    when 'municipality' then array['Kommunbil','Cykel','Nyckel','Passerkort','Matlåda/kylbox','Verktyg','Maskin']::text[]
    when 'courier' then array['Bil','Cykel','Elscooter','Lastbil','Budväska','Handscanner','Kylbox']::text[]
    when 'home_care' then array['Nyckel','Passerkort','Medicinväska','Bil','Cykel']::text[]
    when 'healthcare' then array['Medicinsk utrustning','Väska','Bil','Nyckel','Passerkort']::text[]
    when 'cleaning' then array['Nyckel','Passerkort','Städmaskin','Bil','Cykel','Material']::text[]
    when 'property' then array['Nyckel','Passerkort','Servicebil','Verktyg','Maskin']::text[]
    when 'construction' then array['Borrmaskin','Maskin','Servicebil','Verktygsväska','Lift','Material']::text[]
    when 'field_service' then array['Servicebil','Verktygsväska','Reservdel','Handdator','Nyckel']::text[]
    when 'security' then array['Bil','Nyckel','Passerkort','Radio','Larmtagg']::text[]
    else array['Bil','Cykel','Nyckel','Verktyg','Utrustning']::text[]
  end;
$$;

create or replace function public.coordiqo_runtime_settings(p_industry text, p_operational_model text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'primaryOperationalModel', coalesce(nullif(p_operational_model, ''), 'route_based'),
    'allCoreModulesEnabled', true,
    'isOperationalModelLocked', false,
    'enabledOperationalModels', case coalesce(p_industry, 'other')
      when 'courier' then jsonb_build_array(coalesce(nullif(p_operational_model, ''), 'delivery_based'), 'delivery_based', 'route_based', 'area_based', 'case_based')
      when 'municipality' then jsonb_build_array(coalesce(nullif(p_operational_model, ''), 'area_based'), 'area_based', 'route_based', 'case_based', 'team_based')
      else jsonb_build_array(coalesce(nullif(p_operational_model, ''), 'route_based'), 'route_based', 'object_based', 'case_based', 'team_based', 'project_based')
    end,
    'note', 'Operational model is a primary planning lens, not a hard lock. The company can still use projects, resources, tasks, routes, operations and mobile flows together.'
  );
$$;

create or replace function public.ensure_company_industry_defaults(target_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_industry text;
  v_operational_model text;
  v_preset record;
  v_name text;
  v_code text;
  v_modules text[] := public.coordiqo_core_module_codes();
begin
  select c.industry_type, c.operational_model
    into v_industry, v_operational_model
  from public.companies c
  where c.id = target_company_id;

  if target_company_id is null then
    return;
  end if;

  v_industry := coalesce(nullif(v_industry, ''), 'other');
  v_operational_model := coalesce(nullif(v_operational_model, ''), case when v_industry = 'courier' then 'delivery_based' when v_industry = 'municipality' then 'area_based' else 'route_based' end);

  insert into public.company_modules (company_id, module_code, status, enabled_at, settings)
  select target_company_id, module_code, 'active', timezone('utc', now()), jsonb_build_object('source','industry_sync')
  from unnest(v_modules) as m(module_code)
  on conflict (company_id, module_code) do update set
    status = 'active',
    enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at),
    updated_at = timezone('utc', now());

  insert into public.company_settings (company_id, active_modules, ui_label_set)
  values (target_company_id, v_modules, v_industry)
  on conflict (company_id) do update set
    active_modules = array(select distinct unnest(coalesce(public.company_settings.active_modules, '{}'::text[]) || excluded.active_modules)),
    ui_label_set = excluded.ui_label_set,
    updated_at = timezone('utc', now());

  insert into public.industry_runtime_configs (company_id, industry_code, operational_model, settings)
  values (target_company_id, v_industry, v_operational_model, public.coordiqo_runtime_settings(v_industry, v_operational_model))
  on conflict (company_id) do update set
    industry_code = excluded.industry_code,
    operational_model = excluded.operational_model,
    settings = coalesce(public.industry_runtime_configs.settings, '{}'::jsonb) || excluded.settings,
    updated_at = timezone('utc', now());

  for v_preset in
    select * from public.industry_entity_presets p where p.industry_code = v_industry and p.is_active = true
  loop
    insert into public.entity_types (company_id, code, label_singular, label_plural, description, source, source_preset_id, is_active, sort_order)
    values (target_company_id, v_preset.entity_code, v_preset.label_singular, v_preset.label_plural, v_preset.description, 'industry_preset', v_preset.id, true, v_preset.sort_order)
    on conflict (company_id, code) do update set
      label_singular = excluded.label_singular,
      label_plural = excluded.label_plural,
      description = excluded.description,
      source_preset_id = excluded.source_preset_id,
      is_active = true,
      updated_at = timezone('utc', now());
  end loop;

  foreach v_name in array public.coordiqo_default_task_types(v_industry) loop
    v_code := replace(public.slugify_text(v_name), '-', '_');
    insert into public.task_types (company_id, code, name, description, is_active)
    values (target_company_id, v_code, v_name, 'Standardtyp från branschprofil ' || v_industry, true)
    on conflict (company_id, code) do update set
      name = excluded.name,
      is_active = true,
      updated_at = timezone('utc', now());
  end loop;

  foreach v_name in array public.coordiqo_default_resource_types(v_industry) loop
    v_code := replace(public.slugify_text(v_name), '-', '_');
    insert into public.resource_types (company_id, code, name, description, is_active)
    values (target_company_id, v_code, v_name, 'Standardresurs från branschprofil ' || v_industry, true)
    on conflict (company_id, code) do update set
      name = excluded.name,
      is_active = true,
      updated_at = timezone('utc', now());
  end loop;
end;
$$;

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
  v_industry text := coalesce(nullif(trim(coalesce(p_industry_type, '')), ''), 'other');
  v_operational_model text := coalesce(nullif(trim(coalesce(p_operational_model, '')), ''), 'object_based');
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

  select cm.id into v_existing_membership_id
  from public.company_memberships cm
  where cm.user_id = v_user_id and cm.status = 'active'
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

  insert into public.companies (name, slug, org_number, status, industry_type, operational_model, timezone, language_code)
  values (
    trim(p_company_name),
    v_slug,
    nullif(trim(coalesce(p_org_number, '')), ''),
    'active',
    v_industry,
    v_operational_model,
    coalesce(nullif(trim(coalesce(p_timezone, '')), ''), 'Europe/Stockholm'),
    'sv'
  )
  returning id into v_company_id;

  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

  update public.company_memberships set is_default = false where user_id = v_user_id;

  insert into public.company_memberships (company_id, user_id, role, status, is_default, invited_by)
  values (v_company_id, v_user_id, 'company_admin', 'active', true, v_user_id)
  returning id into v_membership_id;

  insert into public.teams (company_id, name, code, description, status)
  values (v_company_id, coalesce(nullif(trim(coalesce(p_default_team_name, '')), ''), 'Huvudteam'), 'MAIN', 'Första teamet som skapades automatiskt under onboarding.', 'active')
  returning id into v_team_id;

  insert into public.team_memberships (team_id, membership_id, is_primary)
  values (v_team_id, v_membership_id, true)
  on conflict (team_id, membership_id) do nothing;

  perform public.ensure_company_industry_defaults(v_company_id);

  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_company_id,
    v_user_id,
    'company_bootstrap_completed',
    'company',
    v_company_id::text,
    jsonb_build_object(
      'industry_type', v_industry,
      'operational_model', v_operational_model,
      'team_id', v_team_id,
      'source', 'self_serve_onboarding',
      'all_core_modules_enabled', true,
      'operational_model_locked', false
    )
  );

  return v_company_id;
end;
$$;

grant execute on function public.bootstrap_company_for_current_user(text, text, text, text, text, text) to authenticated;

-- Backfill existing companies so old environments behave like newly onboarded environments.
do $$
declare
  v_company record;
begin
  for v_company in select id from public.companies where status = 'active' loop
    perform public.ensure_company_industry_defaults(v_company.id);
  end loop;
end;
$$;
