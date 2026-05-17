-- Coordiqo Batch 8G + 8H
-- Branschprofiler för kommun/bud + daglig operations-/ruttmotor.
-- Idempotent: kan köras även om delar redan finns.

create extension if not exists pgcrypto;

insert into public.industry_types (code, name, description, sort_order) values
  ('municipality', 'Kommunal verksamhet', 'Kommunal drift med enheter, områden, måltidsleverans, intern service, fastighet, park, LSS och transport.', 85),
  ('courier', 'Bud och kurir', 'Pickup, dropoff, multi-stop routes, fordon, tidsfönster, kapacitet och leveransstatus.', 86)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

insert into public.operational_models (code, name, description, sort_order) values
  ('delivery_based', 'Leveransbaserad', 'Arbetet styrs av pickup, dropoff, stopp, fordon, kapacitet och tidsfönster.', 15)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

insert into public.platform_modules (code, name, description, is_core, sort_order) values
  ('operations', 'Operationsvy', 'Daglig kontrollpanel för planering, rutter, resurser, avvikelser och konflikter.', true, 65),
  ('routes', 'Rutter och leveranser', 'Ruttordning, stopp, pickup/dropoff och restidsunderlag.', true, 66),
  ('industry_runtime', 'Branschruntime', 'Aktiva branschlabels, statusar, mobilåtgärder och planeringsregler per företag.', true, 25)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_core = excluded.is_core,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

create table if not exists public.industry_runtime_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  industry_code text not null default 'other',
  operational_model text not null default 'route_based',
  terminology jsonb not null default '{}'::jsonb,
  task_statuses jsonb not null default '[]'::jsonb,
  mobile_actions jsonb not null default '[]'::jsonb,
  planning_rules jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(company_id)
);

create table if not exists public.daily_operation_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  operation_date date not null,
  industry_code text,
  summary jsonb not null default '{}'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique(company_id, operation_date)
);

create table if not exists public.route_plan_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  operation_date date not null,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  route_name text,
  route_kind text not null default 'daily_route',
  status text not null default 'draft',
  start_at timestamptz,
  end_at timestamptz,
  transport_mode text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint route_plan_groups_owner_check check (staff_profile_id is not null or team_id is not null)
);

create table if not exists public.route_plan_stops (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  route_plan_group_id uuid not null references public.route_plan_groups(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  task_assignment_id uuid references public.task_assignments(id) on delete set null,
  stop_order int not null default 1,
  stop_kind text not null default 'work',
  planned_arrival_at timestamptz,
  planned_departure_at timestamptz,
  address_label text,
  pickup_address text,
  dropoff_address text,
  status text not null default 'planned',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'industry_runtime_configs_industry_check') then
    alter table public.industry_runtime_configs add constraint industry_runtime_configs_industry_check
      check (industry_code in ('home_care','healthcare','cleaning','property','construction','parking','staffing','field_service','security','municipality','courier','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'route_plan_groups_status_check') then
    alter table public.route_plan_groups add constraint route_plan_groups_status_check
      check (status in ('draft','planned','published','in_progress','completed','cancelled','archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'route_plan_stops_kind_check') then
    alter table public.route_plan_stops add constraint route_plan_stops_kind_check
      check (stop_kind in ('pickup','dropoff','pickup_dropoff','work','break','return','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'route_plan_stops_status_check') then
    alter table public.route_plan_stops add constraint route_plan_stops_status_check
      check (status in ('planned','assigned','picked_up','en_route','started','completed','failed','returned','cancelled'));
  end if;
end $$;

create index if not exists idx_industry_runtime_configs_company on public.industry_runtime_configs(company_id);
create index if not exists idx_daily_operation_snapshots_company_date on public.daily_operation_snapshots(company_id, operation_date desc);
create index if not exists idx_route_plan_groups_company_date on public.route_plan_groups(company_id, operation_date, status) where archived_at is null;
create index if not exists idx_route_plan_groups_company_staff_date on public.route_plan_groups(company_id, staff_profile_id, operation_date) where archived_at is null and staff_profile_id is not null;
create index if not exists idx_route_plan_stops_company_group_order on public.route_plan_stops(company_id, route_plan_group_id, stop_order) where archived_at is null;
create index if not exists idx_tasks_company_custom_fields_gin on public.tasks using gin (custom_fields);

-- Kommun- och budobjekt som presets.
insert into public.industry_entity_presets (industry_code, entity_code, label_singular, label_plural, description, sort_order) values
  ('municipality', 'recipient', 'Mottagare', 'Mottagare', 'Person, verksamhet eller plats som tar emot kommunal insats/leverans.', 10),
  ('municipality', 'municipal_unit', 'Kommunal enhet', 'Kommunala enheter', 'Enhet/förvaltning såsom måltid, park, fastighet, LSS eller intern service.', 20),
  ('municipality', 'service_object', 'Serviceobjekt', 'Serviceobjekt', 'Skola, fastighet, park, äldreboende, LSS-boende eller annan kommunal plats.', 30),
  ('courier', 'sender', 'Avsändare', 'Avsändare', 'Pickup-plats, lager, butik eller kund som skickar gods.', 10),
  ('courier', 'recipient', 'Mottagare', 'Mottagare', 'Dropoff-mottagare, kund, adress eller leveranspunkt.', 20),
  ('courier', 'hub', 'Hub/lager', 'Hubbar och lager', 'Startpunkt, omlastningspunkt eller lager för budflöden.', 30)
on conflict (industry_code, entity_code) do update set
  label_singular = excluded.label_singular,
  label_plural = excluded.label_plural,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

-- Basruntime för befintliga företag om saknas.
insert into public.industry_runtime_configs (company_id, industry_code, operational_model, terminology, task_statuses, mobile_actions, planning_rules)
select
  c.id,
  c.industry_type,
  case when c.industry_type = 'courier' then 'delivery_based' when c.industry_type = 'municipality' then 'area_based' else coalesce(nullif(c.operational_model, 'task_based'), 'route_based') end,
  case
    when c.industry_type = 'courier' then '{"entity":"Mottagare/kund","entities":"Mottagare och kunder","task":"Leverans","tasks":"Leveranser","staff":"Bud","route":"Leveransrutt","resources":"Fordon/utrustning"}'::jsonb
    when c.industry_type = 'municipality' then '{"entity":"Mottagare/objekt","entities":"Mottagare och objekt","task":"Kommunuppdrag","tasks":"Kommunuppdrag","staff":"Utförare","route":"Rutt/område","resources":"Kommunresurser"}'::jsonb
    else '{"entity":"Objekt","entities":"Objekt","task":"Uppdrag","tasks":"Uppdrag","staff":"Personal","route":"Rutt","resources":"Resurser"}'::jsonb
  end,
  case
    when c.industry_type = 'courier' then '["Planerad","Tilldelad","Hämtad","På väg","Levererad","Misslyckad","Returnerad"]'::jsonb
    when c.industry_type = 'municipality' then '["Planerad","Tilldelad","Påbörjad","Klar","Hinder","Avvikelse"]'::jsonb
    else '["Planerad","Pågår","Klar","Avvikelse"]'::jsonb
  end,
  case
    when c.industry_type = 'courier' then '["Hämtat paket","På väg","Levererat","Kunde ej leverera","Rapportera avvikelse"]'::jsonb
    when c.industry_type = 'municipality' then '["Påbörja uppdrag","Slutför uppdrag","Rapportera hinder","Kvittera resurs"]'::jsonb
    else '["Starta","Klar","Rapportera problem","Kvittera resurs"]'::jsonb
  end,
  case
    when c.industry_type = 'courier' then '["Pickup/dropoff","Tidsfönster","Fordonstyp","Kapacitet","Prioritet","Ruttordning"]'::jsonb
    when c.industry_type = 'municipality' then '["Enhet","Område","Tidsfönster","Fordon","Behörighet","Resursansvar"]'::jsonb
    else '["Tidsfönster","Kompetens","Resurser","Restid"]'::jsonb
  end
from public.companies c
on conflict (company_id) do nothing;

-- Aktivera moduler för befintliga företag.
insert into public.company_modules (company_id, module_code, status, enabled_at, settings)
select c.id, module_code, 'active', timezone('utc', now()), '{}'::jsonb
from public.companies c
cross join (values ('industry_runtime'), ('operations'), ('routes')) as m(module_code)
on conflict (company_id, module_code) do update set
  status = excluded.status,
  enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at),
  updated_at = timezone('utc', now());

update public.company_settings
set active_modules = array(
      select distinct unnest(coalesce(active_modules, '{}'::text[]) || array['industry_runtime','operations','routes'])
    ),
    updated_at = timezone('utc', now());

-- Gör ensure_company_industry_defaults medveten om nya profiler/moduler utan att förstöra tidigare funktion.
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
begin
  select c.industry_type, c.operational_model into v_industry, v_operational_model
  from public.companies c
  where c.id = target_company_id;

  if target_company_id is null or v_industry is null then
    return;
  end if;

  insert into public.company_modules (company_id, module_code, status, enabled_at)
  values
    (target_company_id, 'foundation', 'active', timezone('utc', now())),
    (target_company_id, 'industry_engine', 'active', timezone('utc', now())),
    (target_company_id, 'industry_runtime', 'active', timezone('utc', now())),
    (target_company_id, 'entities', 'active', timezone('utc', now())),
    (target_company_id, 'tasks', 'active', timezone('utc', now())),
    (target_company_id, 'planning', 'active', timezone('utc', now())),
    (target_company_id, 'resources', 'active', timezone('utc', now())),
    (target_company_id, 'resource_responsibility', 'active', timezone('utc', now())),
    (target_company_id, 'operations', 'active', timezone('utc', now())),
    (target_company_id, 'routes', 'active', timezone('utc', now())),
    (target_company_id, 'mobile_staff', 'active', timezone('utc', now()))
  on conflict (company_id, module_code) do update set
    status = excluded.status,
    enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at),
    updated_at = timezone('utc', now());

  update public.company_settings
  set active_modules = array(
        select distinct unnest(coalesce(active_modules, '{}'::text[]) || array['foundation','industry_engine','industry_runtime','entities','tasks','planning','resources','resource_responsibility','operations','routes','mobile_staff'])
      ),
      ui_label_set = v_industry,
      updated_at = timezone('utc', now())
  where company_id = target_company_id;

  if not found then
    insert into public.company_settings (company_id, active_modules, ui_label_set)
    values (target_company_id, array['foundation','industry_engine','industry_runtime','entities','tasks','planning','resources','resource_responsibility','operations','routes','mobile_staff'], v_industry);
  end if;

  insert into public.industry_runtime_configs (company_id, industry_code, operational_model)
  values (target_company_id, v_industry, coalesce(nullif(v_operational_model, 'task_based'), case when v_industry = 'courier' then 'delivery_based' when v_industry = 'municipality' then 'area_based' else 'route_based' end))
  on conflict (company_id) do update set
    industry_code = excluded.industry_code,
    operational_model = excluded.operational_model,
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
end;
$$;

grant execute on function public.ensure_company_industry_defaults(uuid) to authenticated;

-- RLS.
alter table public.industry_runtime_configs enable row level security;
alter table public.daily_operation_snapshots enable row level security;
alter table public.route_plan_groups enable row level security;
alter table public.route_plan_stops enable row level security;

drop policy if exists "industry runtime visible to company members" on public.industry_runtime_configs;
create policy "industry runtime visible to company members" on public.industry_runtime_configs for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "industry runtime managed by company admins" on public.industry_runtime_configs;
create policy "industry runtime managed by company admins" on public.industry_runtime_configs for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'company_admin'));

drop policy if exists "daily operation snapshots visible to company members" on public.daily_operation_snapshots;
create policy "daily operation snapshots visible to company members" on public.daily_operation_snapshots for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "daily operation snapshots managed by planners" on public.daily_operation_snapshots;
create policy "daily operation snapshots managed by planners" on public.daily_operation_snapshots for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'planner'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

drop policy if exists "route plan groups visible to company members" on public.route_plan_groups;
create policy "route plan groups visible to company members" on public.route_plan_groups for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "route plan groups managed by planners" on public.route_plan_groups;
create policy "route plan groups managed by planners" on public.route_plan_groups for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'planner'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

drop policy if exists "route plan stops visible to company members" on public.route_plan_stops;
create policy "route plan stops visible to company members" on public.route_plan_stops for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "route plan stops managed by planners" on public.route_plan_stops;
create policy "route plan stops managed by planners" on public.route_plan_stops for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'planner'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

-- Triggers.
drop trigger if exists trg_industry_runtime_configs_updated_at on public.industry_runtime_configs;
create trigger trg_industry_runtime_configs_updated_at before update on public.industry_runtime_configs
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_route_plan_groups_updated_at on public.route_plan_groups;
create trigger trg_route_plan_groups_updated_at before update on public.route_plan_groups
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_route_plan_stops_updated_at on public.route_plan_stops;
create trigger trg_route_plan_stops_updated_at before update on public.route_plan_stops
for each row execute procedure public.set_updated_at();
