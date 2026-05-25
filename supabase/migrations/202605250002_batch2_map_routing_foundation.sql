-- Coordiqo Batch 2 — Map & Routing Foundation
-- Idempotent geocoding, map and routing schema for future VROOM optimization.

create extension if not exists pgcrypto;

-- Coordinates and geocoding metadata on existing address/task/route structures.
alter table public.entity_addresses add column if not exists formatted_address text;
alter table public.entity_addresses add column if not exists geocode_status text not null default 'pending'
  check (geocode_status in ('pending','queued','geocoded','manual','failed','not_applicable'));
alter table public.entity_addresses add column if not exists geocode_source text;
alter table public.entity_addresses add column if not exists geocode_confidence numeric(5,2);
alter table public.entity_addresses add column if not exists geocoded_at timestamptz;
alter table public.entity_addresses add column if not exists geocode_error text;

alter table public.tasks add column if not exists location_label text;
alter table public.tasks add column if not exists location_latitude numeric(10,7);
alter table public.tasks add column if not exists location_longitude numeric(10,7);
alter table public.tasks add column if not exists geocode_status text not null default 'pending'
  check (geocode_status in ('pending','queued','geocoded','manual','inherited','failed','not_applicable'));
alter table public.tasks add column if not exists geocode_source text;
alter table public.tasks add column if not exists geocoded_at timestamptz;
alter table public.tasks add column if not exists geocode_error text;

alter table public.route_plan_groups add column if not exists planned_distance_meters int;
alter table public.route_plan_groups add column if not exists planned_duration_seconds int;
alter table public.route_plan_groups add column if not exists routing_status text not null default 'not_calculated'
  check (routing_status in ('not_calculated','estimated','calculated','partial','failed'));
alter table public.route_plan_groups add column if not exists routing_provider text;
alter table public.route_plan_groups add column if not exists routing_calculated_at timestamptz;

alter table public.route_plan_stops add column if not exists latitude numeric(10,7);
alter table public.route_plan_stops add column if not exists longitude numeric(10,7);
alter table public.route_plan_stops add column if not exists geocode_status text not null default 'pending'
  check (geocode_status in ('pending','queued','geocoded','manual','inherited','failed','not_applicable'));
alter table public.route_plan_stops add column if not exists travel_from_previous_meters int;
alter table public.route_plan_stops add column if not exists travel_from_previous_seconds int;
alter table public.route_plan_stops add column if not exists eta_at timestamptz;

create table if not exists public.routing_provider_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider_code text not null default 'manual',
  provider_name text not null default 'Manuell/beräknad routing',
  base_url text,
  api_key_secret_name text,
  profile text not null default 'car',
  is_active boolean not null default true,
  is_default boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, provider_code, profile)
);

create table if not exists public.route_distance_cache (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider_code text not null default 'estimated',
  profile text not null default 'car',
  origin_latitude numeric(10,7) not null,
  origin_longitude numeric(10,7) not null,
  destination_latitude numeric(10,7) not null,
  destination_longitude numeric(10,7) not null,
  distance_meters int,
  duration_seconds int,
  quality text not null default 'estimated' check (quality in ('estimated','provider','manual','failed')),
  calculated_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique(company_id, provider_code, profile, origin_latitude, origin_longitude, destination_latitude, destination_longitude)
);

create table if not exists public.service_areas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  area_kind text not null default 'region' check (area_kind in ('region','team','route','service_area','custom')),
  team_id uuid references public.teams(id) on delete set null,
  center_latitude numeric(10,7),
  center_longitude numeric(10,7),
  radius_meters int,
  polygon_geojson jsonb,
  color text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.map_layers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  layer_code text not null,
  name text not null,
  description text,
  layer_type text not null default 'points' check (layer_type in ('points','routes','areas','heatmap','custom')),
  is_enabled boolean not null default true,
  sort_order int not null default 100,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(company_id, layer_code)
);

-- Idempotent default config/layers for every existing tenant.
insert into public.routing_provider_configs (company_id, provider_code, provider_name, profile, is_active, is_default, settings)
select c.id, 'estimated', 'Intern uppskattning utan extern provider', 'car', true, true,
  jsonb_build_object('speed_kmh', 35, 'note', 'Används som fallback tills Valhalla eller GraphHopper är kopplat.')
from public.companies c
where not exists (
  select 1 from public.routing_provider_configs rpc
  where rpc.company_id = c.id and rpc.provider_code = 'estimated' and rpc.profile = 'car'
);

insert into public.map_layers (company_id, layer_code, name, description, layer_type, sort_order, config)
select c.id, 'tasks', 'Uppdrag', 'Visar uppdrag/stopp med koordinater.', 'points', 10, '{}'::jsonb
from public.companies c
on conflict (company_id, layer_code) do nothing;

insert into public.map_layers (company_id, layer_code, name, description, layer_type, sort_order, config)
select c.id, 'routes', 'Rutter', 'Visar ruttlinjer och stoppordning.', 'routes', 20, '{}'::jsonb
from public.companies c
on conflict (company_id, layer_code) do nothing;

insert into public.map_layers (company_id, layer_code, name, description, layer_type, sort_order, config)
select c.id, 'service_areas', 'Områden', 'Visar regioner, teamområden och serviceytor.', 'areas', 30, '{}'::jsonb
from public.companies c
on conflict (company_id, layer_code) do nothing;

create index if not exists idx_entity_addresses_coordinates on public.entity_addresses(latitude, longitude) where latitude is not null and longitude is not null;
create index if not exists idx_entity_addresses_geocode_status on public.entity_addresses(geocode_status);
create index if not exists idx_tasks_company_coordinates on public.tasks(company_id, location_latitude, location_longitude) where location_latitude is not null and location_longitude is not null and archived_at is null;
create index if not exists idx_tasks_company_geocode_status on public.tasks(company_id, geocode_status) where archived_at is null;
create index if not exists idx_route_plan_stops_company_coordinates on public.route_plan_stops(company_id, latitude, longitude) where latitude is not null and longitude is not null and archived_at is null;
create index if not exists idx_route_plan_groups_company_routing on public.route_plan_groups(company_id, operation_date, routing_status) where archived_at is null;
create index if not exists idx_routing_provider_configs_company_active on public.routing_provider_configs(company_id, is_active, is_default) where archived_at is null;
create index if not exists idx_route_distance_cache_lookup on public.route_distance_cache(company_id, provider_code, profile, origin_latitude, origin_longitude, destination_latitude, destination_longitude);
create index if not exists idx_service_areas_company_kind on public.service_areas(company_id, area_kind, is_active) where archived_at is null;
create index if not exists idx_map_layers_company_enabled on public.map_layers(company_id, is_enabled, sort_order);

alter table public.routing_provider_configs enable row level security;
alter table public.route_distance_cache enable row level security;
alter table public.service_areas enable row level security;
alter table public.map_layers enable row level security;

drop policy if exists "routing configs visible to company members" on public.routing_provider_configs;
create policy "routing configs visible to company members" on public.routing_provider_configs for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "routing configs managed by operations" on public.routing_provider_configs;
create policy "routing configs managed by operations" on public.routing_provider_configs for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'));

drop policy if exists "distance cache visible to company members" on public.route_distance_cache;
create policy "distance cache visible to company members" on public.route_distance_cache for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "distance cache managed by planners" on public.route_distance_cache;
create policy "distance cache managed by planners" on public.route_distance_cache for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'planner'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

drop policy if exists "service areas visible to company members" on public.service_areas;
create policy "service areas visible to company members" on public.service_areas for select
using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "service areas managed by operations" on public.service_areas;
create policy "service areas managed by operations" on public.service_areas for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'));

drop policy if exists "map layers visible to company members" on public.map_layers;
create policy "map layers visible to company members" on public.map_layers for select
using (company_id is null or public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists "map layers managed by operations" on public.map_layers;
create policy "map layers managed by operations" on public.map_layers for all
using (public.is_platform_admin() or (company_id is not null and public.has_company_role(company_id, 'operations_manager')))
with check (public.is_platform_admin() or (company_id is not null and public.has_company_role(company_id, 'operations_manager')));

drop trigger if exists trg_routing_provider_configs_updated_at on public.routing_provider_configs;
create trigger trg_routing_provider_configs_updated_at before update on public.routing_provider_configs
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_service_areas_updated_at on public.service_areas;
create trigger trg_service_areas_updated_at before update on public.service_areas
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_map_layers_updated_at on public.map_layers;
create trigger trg_map_layers_updated_at before update on public.map_layers
for each row execute procedure public.set_updated_at();

create or replace view public.coordiqo_routing_readiness_v as
select
  c.id as company_id,
  c.name as company_name,
  c.status as company_status,
  c.lifecycle_status,
  (select count(*) from public.entity_addresses ea join public.entities e on e.id = ea.entity_id where e.company_id = c.id and e.archived_at is null) as address_count,
  (select count(*) from public.entity_addresses ea join public.entities e on e.id = ea.entity_id where e.company_id = c.id and e.archived_at is null and ea.latitude is not null and ea.longitude is not null) as geocoded_address_count,
  (select count(*) from public.tasks t where t.company_id = c.id and t.archived_at is null) as task_count,
  (select count(*) from public.tasks t where t.company_id = c.id and t.archived_at is null and t.location_latitude is not null and t.location_longitude is not null) as task_coordinate_count,
  (select count(*) from public.route_plan_stops rps where rps.company_id = c.id and rps.archived_at is null) as route_stop_count,
  (select count(*) from public.route_plan_stops rps where rps.company_id = c.id and rps.archived_at is null and rps.latitude is not null and rps.longitude is not null) as route_stop_coordinate_count,
  (select count(*) from public.routing_provider_configs rpc where rpc.company_id = c.id and rpc.archived_at is null and rpc.is_active) as active_routing_provider_count,
  (select count(*) from public.route_distance_cache rdc where rdc.company_id = c.id) as cached_matrix_entries
from public.companies c;
