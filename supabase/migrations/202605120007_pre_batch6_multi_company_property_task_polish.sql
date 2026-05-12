-- Coordiqo pre-Batch 6 hardening
-- Multi-company owner flow, property/landlord email intake, task UX support and staff-list reliability.

create extension if not exists pgcrypto;

-- Same user can manage multiple companies. Requests cover cases where an existing company must approve access.
create table if not exists public.company_access_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid references public.profiles(id) on delete cascade,
  requester_email text,
  target_company_id uuid references public.companies(id) on delete set null,
  company_name text not null,
  request_type text not null default 'join_existing' check (request_type in ('join_existing', 'new_company_review')),
  requested_role text not null default 'company_admin',
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

-- Property / landlord email intake. External mail/webhook can write inbound_emails later.
create table if not exists public.property_email_channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  inbound_email text not null,
  display_name text not null default 'Felanmälan',
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  create_service_request boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique(company_id, inbound_email)
);

create table if not exists public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  channel_id uuid references public.property_email_channels(id) on delete set null,
  from_email text not null,
  from_name text,
  to_email text,
  subject text not null,
  body_text text,
  body_html text,
  status text not null default 'new' check (status in ('new', 'matched', 'unmatched', 'converted', 'ignored', 'archived')),
  matched_entity_id uuid references public.entities(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete set null,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

-- Helpful indexes for property flows and contact matching.
create index if not exists idx_company_access_requests_requester on public.company_access_requests(requester_user_id, status) where archived_at is null;
create index if not exists idx_company_access_requests_target on public.company_access_requests(target_company_id, status) where archived_at is null;
create index if not exists idx_property_email_channels_company on public.property_email_channels(company_id, status) where archived_at is null;
create index if not exists idx_inbound_emails_company_status on public.inbound_emails(company_id, status) where archived_at is null;
create index if not exists idx_inbound_emails_company_from on public.inbound_emails(company_id, lower(from_email)) where archived_at is null;
create index if not exists idx_entity_contacts_email_lower on public.entity_contacts(lower(email)) where email is not null;

-- More complete property object hierarchy and default fields.
insert into public.industry_entity_presets (industry_code, entity_code, label_singular, label_plural, description, sort_order) values
  ('property', 'building', 'Byggnad', 'Byggnader', 'Byggnader inom en fastighet eller ett område.', 15),
  ('property', 'floor', 'Våningsplan', 'Våningsplan', 'Våningar eller trapphus som används för struktur och ronder.', 18),
  ('property', 'supplier', 'Leverantör', 'Leverantörer', 'Entreprenörer och servicepartners kopplade till arbetsorder.', 60)
on conflict (industry_code, entity_code) do update set
  label_singular = excluded.label_singular,
  label_plural = excluded.label_plural,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

-- Ensure property companies get the new presets if they already existed before this migration.
insert into public.entity_types (company_id, code, label_singular, label_plural, description, source, source_preset_id, is_active, sort_order)
select c.id, p.entity_code, p.label_singular, p.label_plural, p.description, 'industry_preset', p.id, true, p.sort_order
from public.companies c
join public.industry_entity_presets p on p.industry_code = 'property'
where c.industry_type = 'property'
on conflict (company_id, code) do nothing;

-- Add useful default dynamic fields to property entity types without forcing a locked model.
insert into public.entity_type_fields (entity_type_id, field_key, label, field_type, is_required, is_sensitive, sort_order, config)
select et.id, v.field_key, v.label, v.field_type, v.is_required, v.is_sensitive, v.sort_order, v.config::jsonb
from public.entity_types et
join public.companies c on c.id = et.company_id
cross join (values
  ('property_number', 'Fastighetsbeteckning/objektnummer', 'text', false, false, 10, '{"placeholder":"Ex. Malmö X:1"}'),
  ('management_area', 'Förvaltningsområde', 'text', false, false, 20, '{}'),
  ('access_level', 'Access/nyckelnivå', 'text', false, true, 30, '{}')
) as v(field_key, label, field_type, is_required, is_sensitive, sort_order, config)
where c.industry_type = 'property' and et.code = 'property'
on conflict (entity_type_id, field_key) do nothing;

insert into public.entity_type_fields (entity_type_id, field_key, label, field_type, is_required, is_sensitive, sort_order, config)
select et.id, v.field_key, v.label, v.field_type, v.is_required, v.is_sensitive, v.sort_order, v.config::jsonb
from public.entity_types et
join public.companies c on c.id = et.company_id
cross join (values
  ('unit_number', 'Lägenhets-/lokalnummer', 'text', false, false, 10, '{"placeholder":"Ex. 1203"}'),
  ('floor', 'Våning', 'text', false, false, 20, '{}'),
  ('size_sqm', 'Yta kvm', 'number', false, false, 30, '{}'),
  ('rent_reference', 'Hyres-/kontraktsreferens', 'text', false, true, 40, '{}')
) as v(field_key, label, field_type, is_required, is_sensitive, sort_order, config)
where c.industry_type = 'property' and et.code = 'unit'
on conflict (entity_type_id, field_key) do nothing;

-- Industry-specific task types so the task form feels right per company type.
insert into public.task_types (company_id, code, name, description, default_duration_minutes, default_priority)
select c.id, v.code, v.name, v.description, v.duration, v.priority
from public.companies c
cross join (values
  ('property_fault', 'Felanmälan', 'Hyresgäst- eller objektrelaterad felanmälan.', 60, 'high'),
  ('property_inspection', 'Besiktning', 'Besiktning av lägenhet, lokal eller fastighet.', 90, 'normal'),
  ('property_maintenance', 'Underhåll', 'Planerat eller akut underhåll.', 120, 'normal'),
  ('property_round', 'Rond/kontroll', 'Rond, kontrollpunkt eller återkommande fastighetskontroll.', 45, 'normal')
) as v(code, name, description, duration, priority)
where c.industry_type = 'property'
on conflict (company_id, code) do nothing;

insert into public.task_types (company_id, code, name, description, default_duration_minutes, default_priority)
select c.id, v.code, v.name, v.description, v.duration, v.priority
from public.companies c
cross join (values
  ('care_visit', 'Omsorgsbesök', 'Planerad insats hos vårdtagare.', 30, 'normal'),
  ('care_double_staff', 'Dubbelbemannad insats', 'Insats som kräver två personer senare i regelmotorn.', 45, 'high'),
  ('care_followup', 'Uppföljning', 'Uppföljande besök eller kontroll.', 20, 'normal')
) as v(code, name, description, duration, priority)
where c.industry_type = 'home_care'
on conflict (company_id, code) do nothing;

insert into public.platform_modules (code, name, description, is_core, sort_order)
values ('property_pack', 'Fastighetspaket', 'Fastighetsvy, felanmälan via e-post, hyresgästkoppling och objekthierarki.', false, 47)
on conflict (code) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, updated_at = timezone('utc', now());

insert into public.company_modules (company_id, module_code, status, enabled_at)
select id, 'property_pack', case when industry_type = 'property' then 'active' else 'planned' end, case when industry_type = 'property' then timezone('utc', now()) else null end
from public.companies
on conflict (company_id, module_code) do update set status = excluded.status, enabled_at = coalesce(public.company_modules.enabled_at, excluded.enabled_at), updated_at = timezone('utc', now());

-- Updated-at triggers.
drop trigger if exists set_company_access_requests_updated_at on public.company_access_requests;
create trigger set_company_access_requests_updated_at before update on public.company_access_requests for each row execute function public.set_updated_at();
drop trigger if exists set_property_email_channels_updated_at on public.property_email_channels;
create trigger set_property_email_channels_updated_at before update on public.property_email_channels for each row execute function public.set_updated_at();

-- RLS.
alter table public.company_access_requests enable row level security;
alter table public.property_email_channels enable row level security;
alter table public.inbound_emails enable row level security;

drop policy if exists "company access requests visible to requester or platform" on public.company_access_requests;
create policy "company access requests visible to requester or platform" on public.company_access_requests
for select using (public.is_platform_admin() or requester_user_id = auth.uid() or (target_company_id is not null and public.has_company_role(target_company_id, 'company_admin')));

drop policy if exists "company access requests inserted by authenticated" on public.company_access_requests;
create policy "company access requests inserted by authenticated" on public.company_access_requests
for insert with check (auth.uid() = requester_user_id);

drop policy if exists "company access requests reviewed by admins" on public.company_access_requests;
create policy "company access requests reviewed by admins" on public.company_access_requests
for update using (public.is_platform_admin() or (target_company_id is not null and public.has_company_role(target_company_id, 'company_admin')))
with check (public.is_platform_admin() or (target_company_id is not null and public.has_company_role(target_company_id, 'company_admin')));

drop policy if exists "property channels visible to company members" on public.property_email_channels;
create policy "property channels visible to company members" on public.property_email_channels for select using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists "property channels managed by operations" on public.property_email_channels;
create policy "property channels managed by operations" on public.property_email_channels for all using (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'operations_manager'));

drop policy if exists "inbound emails visible to company members" on public.inbound_emails;
create policy "inbound emails visible to company members" on public.inbound_emails for select using (public.is_platform_admin() or public.is_company_member(company_id));
drop policy if exists "inbound emails managed by planners" on public.inbound_emails;
create policy "inbound emails managed by planners" on public.inbound_emails for all using (public.is_platform_admin() or public.has_company_role(company_id, 'planner')) with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));
