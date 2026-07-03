-- Coordiqo go-live: full lead pipeline, package registry and commercial fields.
--
-- Additive and idempotent. Existing demo request rows keep their status values
-- (the widened check constraint includes all previous statuses).

-- 1. Demo request lifecycle -----------------------------------------------------

alter table public.demo_requests add column if not exists archived_at timestamptz;
alter table public.demo_requests add column if not exists lost_reason text;

do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.demo_requests'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';

  if v_constraint is not null then
    execute format('alter table public.demo_requests drop constraint %I', v_constraint);
  end if;

  alter table public.demo_requests add constraint demo_requests_status_check
    check (status in (
      'new', 'contacted', 'qualified', 'demo_booked', 'offer_sent',
      'pilot_offered', 'pilot_started', 'company_created',
      'onboarding_started', 'won', 'lost', 'archived'
    ));
end $$;

-- Funnel view covering the full lifecycle. Recreated because the column list
-- changes; the view holds no data.
drop view if exists public.coordiqo_demo_request_readiness_v;
create view public.coordiqo_demo_request_readiness_v
with (security_invoker = true)
as
select
  count(*) as total_leads,
  count(*) filter (where status = 'new') as new_leads,
  count(*) filter (where status = 'contacted') as contacted_leads,
  count(*) filter (where status = 'qualified') as qualified_leads,
  count(*) filter (where status = 'demo_booked') as demo_booked_leads,
  count(*) filter (where status = 'offer_sent') as offer_sent_leads,
  count(*) filter (where status = 'pilot_offered') as pilot_offered_leads,
  count(*) filter (where status = 'pilot_started') as pilot_started_leads,
  count(*) filter (where status = 'company_created') as company_created_leads,
  count(*) filter (where status = 'onboarding_started') as onboarding_started_leads,
  count(*) filter (where status = 'won') as won_leads,
  count(*) filter (where status = 'lost') as lost_leads,
  count(*) filter (where status = 'archived') as archived_leads
from public.demo_requests;

-- 2. Package registry -----------------------------------------------------------

create table if not exists public.packages (
  code text primary key,
  name_sv text not null,
  name_en text,
  description_sv text,
  target_customer text,
  included_modules jsonb not null default '[]'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  trial_days int,
  monthly_price_sek numeric,
  setup_fee_sek numeric,
  requires_sales_contact boolean not null default true,
  is_public boolean not null default false,
  sort_order int not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

drop trigger if exists trg_packages_updated_at on public.packages;
create trigger trg_packages_updated_at before update on public.packages
for each row execute procedure public.set_updated_at();

alter table public.packages enable row level security;

drop policy if exists packages_select on public.packages;
create policy packages_select on public.packages for select using (true);

drop policy if exists packages_platform_write on public.packages;
create policy packages_platform_write on public.packages
for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Prices are intentionally left null: pricing is "Offert efter behov" until
-- the commercial team sets real numbers from admin/configuration.
insert into public.packages (code, name_sv, name_en, description_sv, target_customer, included_modules, limits, trial_days, requires_sales_contact, is_public, sort_order) values
  (
    'demo', 'Demo', 'Demo',
    'Produktgenomgång med exempeldata. Skapas manuellt av Coordiqo-teamet och innehåller ingen produktionsdata.',
    'Intresserade företag före pilot',
    '["all_core"]'::jsonb, '{"production_data": false}'::jsonb,
    null, true, false, 10
  ),
  (
    'pilot', 'Pilot', 'Pilot',
    'Tidsbegränsad pilot med valt branschflöde och guidad onboarding. Lämplig innan fullt avtal.',
    'Företag som vill testa Coordiqo i sin verksamhet',
    '["all_core"]'::jsonb, '{"pilot": true}'::jsonb,
    30, true, true, 20
  ),
  (
    'standard', 'Standard', 'Standard',
    'Kärnplanering med personal, uppdrag, resurser, mobil utförandevy och rapporter för ett bolag.',
    'Små och medelstora verksamheter',
    '["planning","staff","tasks","resources","mobile","reports"]'::jsonb, '{"companies": 1}'::jsonb,
    null, true, true, 30
  ),
  (
    'pro', 'Pro', 'Pro',
    'Avancerad planering med flera team och platser, automatiseringar, integrationer och prioriterad support.',
    'Växande verksamheter med flera team',
    '["planning_advanced","multi_team","automations","integrations","priority_support"]'::jsonb, '{}'::jsonb,
    null, true, true, 40
  ),
  (
    'enterprise', 'Enterprise', 'Enterprise',
    'Anpassad uppsättning med flera bolag, egna integrationer, SLA och säkerhetsgenomgång.',
    'Stora organisationer och kommuner',
    '["custom"]'::jsonb, '{}'::jsonb,
    null, true, true, 50
  )
on conflict (code) do update set
  name_sv = excluded.name_sv,
  name_en = excluded.name_en,
  description_sv = case when public.packages.description_sv is null then excluded.description_sv else public.packages.description_sv end,
  target_customer = case when public.packages.target_customer is null then excluded.target_customer else public.packages.target_customer end,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

-- 3. Company commercial lifecycle fields ----------------------------------------

alter table public.companies add column if not exists package_code text references public.packages(code) on delete set null;
alter table public.companies add column if not exists contract_status text not null default 'none';
alter table public.companies add column if not exists pilot_starts_on date;
alter table public.companies add column if not exists pilot_ends_on date;
alter table public.companies add column if not exists billing_contact_email text;
alter table public.companies add column if not exists billing_org_number text;
alter table public.companies add column if not exists sales_owner uuid references public.profiles(id) on delete set null;
alter table public.companies add column if not exists customer_success_owner uuid references public.profiles(id) on delete set null;
alter table public.companies add column if not exists renewal_date date;
alter table public.companies add column if not exists cancellation_date date;
alter table public.companies add column if not exists commercial_notes text;
alter table public.companies add column if not exists is_demo boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'companies_contract_status_check') then
    alter table public.companies add constraint companies_contract_status_check
      check (contract_status in ('none', 'demo', 'pilot', 'active', 'cancelled'));
  end if;
end $$;

create index if not exists idx_companies_is_demo on public.companies(is_demo) where is_demo = true;
create index if not exists idx_companies_package_code on public.companies(package_code) where package_code is not null;
