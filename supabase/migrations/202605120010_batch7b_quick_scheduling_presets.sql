-- Batch 7B: quick scheduling UX, shift presets and bulk schedule creation

alter table public.shifts add column if not exists bulk_group_id uuid;
alter table public.shifts add column if not exists source_preset_id uuid;
alter table public.shifts add column if not exists created_from text not null default 'manual';
alter table public.shifts add column if not exists bulk_run_id uuid;

create table if not exists public.shift_presets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  industry_type text,
  operational_model text,
  name text not null,
  description text,
  preset_scope text not null default 'company' check (preset_scope in ('system', 'company')),
  preset_type text not null default 'standard',
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0,
  buffer_minutes integer not null default 0,
  transport_mode text not null default 'car',
  start_location_type text not null default 'company_base',
  start_address_text text,
  end_location_type text not null default 'company_base',
  end_address_text text,
  default_status text not null default 'draft',
  capacity_minutes integer,
  min_staff integer,
  max_staff integer,
  default_team_id uuid references public.teams(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  is_favorite boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint shift_presets_company_scope_check check (
    (preset_scope = 'system' and company_id is null) or (preset_scope = 'company' and company_id is not null)
  )
);

create unique index if not exists shift_presets_system_unique_idx
on public.shift_presets (preset_scope, coalesce(industry_type, 'generic'), lower(name))
where preset_scope = 'system' and archived_at is null;

create unique index if not exists shift_presets_company_unique_idx
on public.shift_presets (company_id, lower(name))
where preset_scope = 'company' and archived_at is null;

create table if not exists public.shift_preset_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  preset_id uuid not null references public.shift_presets(id) on delete cascade,
  requirement_type text not null,
  skill_id uuid references public.skills(id) on delete set null,
  certification_id uuid references public.certifications(id) on delete set null,
  role_label text,
  transport_mode text,
  is_hard boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create table if not exists public.shift_bulk_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  preset_id uuid references public.shift_presets(id) on delete set null,
  name text not null,
  date_from date not null,
  date_to date not null,
  weekdays integer[] not null default array[1,2,3,4,5],
  target_type text not null default 'staff' check (target_type in ('staff', 'team', 'mixed')),
  target_staff_ids uuid[] not null default '{}'::uuid[],
  target_team_ids uuid[] not null default '{}'::uuid[],
  default_status text not null default 'draft',
  conflict_mode text not null default 'skip_blocking' check (conflict_mode in ('create_all', 'skip_conflicts', 'skip_blocking')),
  created_count integer not null default 0,
  skipped_count integer not null default 0,
  conflict_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  constraint shift_bulk_runs_date_order check (date_to >= date_from)
);

create table if not exists public.shift_bulk_run_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bulk_run_id uuid not null references public.shift_bulk_runs(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  shift_date date not null,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'created',
  conflict_level text,
  conflict_summary text,
  skipped_reason text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists shift_presets_company_idx on public.shift_presets(company_id, archived_at, is_active);
create index if not exists shift_presets_industry_idx on public.shift_presets(industry_type, preset_scope, archived_at);
create index if not exists shift_bulk_runs_company_idx on public.shift_bulk_runs(company_id, created_at desc);
create index if not exists shift_bulk_run_items_run_idx on public.shift_bulk_run_items(bulk_run_id);
create index if not exists shifts_bulk_group_idx on public.shifts(company_id, bulk_group_id) where bulk_group_id is not null;
create index if not exists shifts_source_preset_idx on public.shifts(company_id, source_preset_id) where source_preset_id is not null;

-- Seed system presets. They are intentionally neutral and dynamic by industry.
insert into public.shift_presets (preset_scope, company_id, industry_type, name, description, preset_type, start_time, end_time, break_minutes, buffer_minutes, transport_mode, default_status, min_staff, metadata)
values
  ('system', null, null, 'Dagpass', 'Generellt dagpass för verksamheter som inte valt bransch.', 'standard', '07:00', '16:00', 30, 15, 'car', 'draft', 1, '{"category":"generic"}'),
  ('system', null, null, 'Kvällspass', 'Generellt kvällspass.', 'standard', '15:00', '22:00', 30, 15, 'car', 'draft', 1, '{"category":"generic"}'),
  ('system', null, null, 'Nattpass', 'Generellt nattpass.', 'standard', '22:00', '07:00', 30, 15, 'car', 'draft', 1, '{"category":"generic","overnight":true}'),

  ('system', null, 'home_care', 'Hemtjänst morgon', 'Morgonrunda för vårdtagare/patienter.', 'care', '07:00', '11:00', 0, 15, 'car', 'draft', 1, '{"care_window":"morning"}'),
  ('system', null, 'home_care', 'Hemtjänst dagpass', 'Dagpass för omsorgsplanering.', 'care', '07:00', '16:00', 30, 20, 'car', 'draft', 1, '{"care_window":"day"}'),
  ('system', null, 'home_care', 'Hemtjänst kväll', 'Kvällsinsatser och tillsyn.', 'care', '17:00', '21:00', 0, 15, 'car', 'draft', 1, '{"care_window":"evening"}'),
  ('system', null, 'home_care', 'Nattpatrull', 'Nattpatrull för vård/omsorg.', 'care', '21:00', '07:00', 30, 20, 'car', 'draft', 1, '{"care_window":"night","overnight":true}'),

  ('system', null, 'healthcare', 'Vård dagpass', 'Dagpass för vård/hemsjukvård.', 'care', '07:00', '16:00', 30, 20, 'car', 'draft', 1, '{"healthcare":true}'),
  ('system', null, 'healthcare', 'Vård kväll', 'Kvällspass för vård/hemsjukvård.', 'care', '15:00', '22:00', 30, 20, 'car', 'draft', 1, '{"healthcare":true}'),

  ('system', null, 'cleaning', 'Kontorsstäd kväll', 'Kontorsstäd efter öppettid.', 'cleaning', '18:00', '22:00', 0, 10, 'car', 'draft', 1, '{"cleaning_type":"office_evening"}'),
  ('system', null, 'cleaning', 'Trappstäd morgon', 'Trappstäd och gemensamma ytor.', 'cleaning', '06:00', '10:00', 0, 10, 'car', 'draft', 1, '{"cleaning_type":"stairwell"}'),
  ('system', null, 'cleaning', 'Flyttstäd heldag', 'Heldag för flyttstäd/storstäd.', 'cleaning', '08:00', '17:00', 45, 20, 'service_vehicle', 'draft', 2, '{"cleaning_type":"move_out"}'),

  ('system', null, 'property', 'Fastighet dag', 'Fastighetsskötsel och arbetsorder dagtid.', 'property', '08:00', '17:00', 45, 20, 'service_vehicle', 'draft', 1, '{"property_type":"day"}'),
  ('system', null, 'property', 'Rondering morgon', 'Rondering och tillsyn.', 'property', '07:00', '11:00', 0, 15, 'service_vehicle', 'draft', 1, '{"property_type":"round"}'),
  ('system', null, 'property', 'Felanmälan jour', 'Jourpass för akuta felanmälningar.', 'property', '16:00', '22:00', 0, 30, 'service_vehicle', 'draft', 1, '{"property_type":"on_call"}'),

  ('system', null, 'field_service', 'Tekniker dag', 'Standard teknikerpass.', 'service', '07:30', '16:00', 30, 20, 'service_vehicle', 'draft', 1, '{"service_type":"day"}'),
  ('system', null, 'field_service', 'Servicefönster förmiddag', 'Kortare servicefönster.', 'service', '08:00', '12:00', 0, 15, 'service_vehicle', 'draft', 1, '{"service_window":"morning"}'),
  ('system', null, 'field_service', 'Jour kväll', 'Kvällsjour för tekniker/service.', 'service', '16:00', '22:00', 0, 30, 'service_vehicle', 'draft', 1, '{"service_window":"evening"}'),

  ('system', null, 'parking', 'Patrull dag', 'Dagpatrull för parkeringsövervakning.', 'patrol', '08:00', '16:00', 30, 15, 'car', 'draft', 1, '{"patrol":"day"}'),
  ('system', null, 'parking', 'Nattpatrull', 'Nattpatrull och kontroll.', 'patrol', '22:00', '06:00', 30, 15, 'car', 'draft', 1, '{"patrol":"night","overnight":true}'),

  ('system', null, 'security', 'Bevakning dag', 'Dagpass för bevakning.', 'security', '07:00', '15:00', 30, 15, 'car', 'draft', 1, '{"security":"day"}'),
  ('system', null, 'security', 'Nattbevakning', 'Nattpass för bevakning.', 'security', '22:00', '06:00', 30, 15, 'car', 'draft', 1, '{"security":"night","overnight":true}'),

  ('system', null, 'construction', 'Byggdag', 'Standard byggdag.', 'construction', '07:00', '16:00', 30, 15, 'service_vehicle', 'draft', 1, '{"construction":"day"}'),
  ('system', null, 'construction', 'Platskontroll', 'Kort platskontroll/besiktning.', 'construction', '09:00', '12:00', 0, 10, 'service_vehicle', 'draft', 1, '{"construction":"inspection"}')
on conflict do nothing;

-- Keep updated_at fresh.
drop trigger if exists trg_shift_presets_updated_at on public.shift_presets;
create trigger trg_shift_presets_updated_at before update on public.shift_presets
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_shift_preset_requirements_updated_at on public.shift_preset_requirements;
create trigger trg_shift_preset_requirements_updated_at before update on public.shift_preset_requirements
for each row execute procedure public.set_updated_at();

alter table public.shift_presets enable row level security;
alter table public.shift_preset_requirements enable row level security;
alter table public.shift_bulk_runs enable row level security;
alter table public.shift_bulk_run_items enable row level security;

drop policy if exists shift_presets_select on public.shift_presets;
create policy shift_presets_select on public.shift_presets
for select using (
  preset_scope = 'system'
  or public.is_platform_admin()
  or (company_id is not null and public.is_company_member(company_id))
);

drop policy if exists shift_presets_company_write on public.shift_presets;
create policy shift_presets_company_write on public.shift_presets
for all using (public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)))
with check (public.is_platform_admin() or (company_id is not null and public.is_company_member(company_id)));

drop policy if exists shift_preset_requirements_company_all on public.shift_preset_requirements;
create policy shift_preset_requirements_company_all on public.shift_preset_requirements
for all using (
  public.is_platform_admin()
  or (company_id is not null and public.is_company_member(company_id))
  or exists (
    select 1 from public.shift_presets sp
    where sp.id = preset_id and sp.preset_scope = 'system'
  )
)
with check (
  public.is_platform_admin()
  or (company_id is not null and public.is_company_member(company_id))
  or exists (
    select 1 from public.shift_presets sp
    where sp.id = preset_id and sp.preset_scope = 'system'
  )
);

drop policy if exists shift_bulk_runs_company_all on public.shift_bulk_runs;
create policy shift_bulk_runs_company_all on public.shift_bulk_runs
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists shift_bulk_run_items_company_all on public.shift_bulk_run_items;
create policy shift_bulk_run_items_company_all on public.shift_bulk_run_items
for all using (public.is_platform_admin() or public.is_company_member(company_id))
with check (public.is_platform_admin() or public.is_company_member(company_id));
