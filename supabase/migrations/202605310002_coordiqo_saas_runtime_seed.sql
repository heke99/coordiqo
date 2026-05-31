-- Coordiqo SaaS runtime seed and pilot readiness hardening.
-- Safe/idempotent. Adds default categories, prompts, templates, demo scenarios and relaxed project statuses.

create extension if not exists pgcrypto;

-- Align project lifecycle with the SaaS build plan.
alter table if exists public.projects drop constraint if exists projects_status_check;
alter table if exists public.projects
  add constraint projects_status_check check (status in (
    'draft',
    'estimating',
    'calculated',
    'waiting_for_approval',
    'planned',
    'active',
    'paused',
    'completed',
    'actuals_required',
    'closed',
    'cancelled',
    'archived'
  ));

do $$
begin
  if to_regclass('public.projects') is not null and to_regclass('public.project_calculation_runs') is not null then
    if not exists (select 1 from pg_constraint where conname = 'projects_approved_calculation_run_fk' and conrelid = 'public.projects'::regclass) then
      alter table public.projects
        add constraint projects_approved_calculation_run_fk
        foreign key (approved_calculation_run_id) references public.project_calculation_runs(id) on delete set null;
    end if;
  end if;
end $$;

-- System deviation categories used by all tenants.
insert into public.deviation_categories (scope, company_id, code, name, description, default_priority, sort_order)
values
  ('system', null, 'delay', 'Försening', 'Uppdrag, rutt eller projekt riskerar att bli sent.', 'high', 10),
  ('system', null, 'customer_not_home', 'Kund ej hemma', 'Besök eller leverans kan inte utföras eftersom kund saknas.', 'normal', 20),
  ('system', null, 'wrong_address', 'Fel adress', 'Adress eller åtkomstinformation behöver rättas.', 'high', 30),
  ('system', null, 'missing_resource', 'Saknad resurs', 'Nyckel, fordon, verktyg eller material saknas.', 'high', 40),
  ('system', null, 'vehicle_issue', 'Fordonsproblem', 'Fordon är trasigt, dubbelbokat eller inte tillgängligt.', 'high', 50),
  ('system', null, 'sick_staff', 'Sjuk personal', 'Bemanning behöver ändras på grund av frånvaro.', 'high', 60),
  ('system', null, 'customer_complaint', 'Kundklagomål', 'Kund eller anhörig har rapporterat problem.', 'high', 70),
  ('system', null, 'sla_risk', 'SLA-risk', 'Avtalad tid eller servicenivå riskerar att brytas.', 'urgent', 80),
  ('system', null, 'work_environment', 'Arbetsmiljörisk', 'Risk för personal, kund eller utförande.', 'urgent', 90)
on conflict do nothing;

-- AI prompt registry. Prompts are decision-support only; sensitive actions require human approval.
insert into public.ai_prompt_registry (scope, company_id, prompt_key, locale, title, prompt_template, version, status, metadata)
values
  ('system', null, 'operations_summary', 'sv', 'Operationssummering', 'Sammanfatta läget för dagens drift på svenska. Föreslå åtgärder men fatta inga beslut.', 1, 'active', '{"agent":"Summary Agent"}'),
  ('system', null, 'operations_summary', 'en', 'Operations summary', 'Summarize today operations in English. Suggest actions but do not make decisions.', 1, 'active', '{"agent":"Summary Agent"}'),
  ('system', null, 'message_classifier', 'sv', 'Meddelandeklassificering', 'Klassificera meddelandet: normal chatt, uppdrag, avvikelse, omplanering eller kundkommunikation. Returnera förslag med risknivå.', 1, 'active', '{"agent":"Message Classifier Agent"}'),
  ('system', null, 'message_classifier', 'en', 'Message classification', 'Classify the message: normal chat, task, deviation, replanning or customer communication. Return suggestion with risk level.', 1, 'active', '{"agent":"Message Classifier Agent"}'),
  ('system', null, 'project_calculation_agent', 'sv', 'Projektkalkylassistent', 'Tolka projektbeskrivning, identifiera saknade frågor och föreslå arbetsmoment. Coordiqo-regler räknar slutligt.', 1, 'active', '{"agent":"Project Calculation Agent"}'),
  ('system', null, 'project_calculation_agent', 'en', 'Project calculation assistant', 'Interpret project description, identify missing questions and suggest work items. Coordiqo rules calculate final values.', 1, 'active', '{"agent":"Project Calculation Agent"}'),
  ('system', null, 'knowledge_agent', 'sv', 'Kunskapsagent', 'Svara med källhänvisning från Notion/kunskapsbas. Använd aldrig kunskap som operativ källa till sanning.', 1, 'active', '{"agent":"Knowledge Agent"}'),
  ('system', null, 'knowledge_agent', 'en', 'Knowledge agent', 'Answer with source references from Notion/knowledge base. Never use knowledge as operational source of truth.', 1, 'active', '{"agent":"Knowledge Agent"}')
on conflict do nothing;

-- SMS templates with locale-ready keys.
insert into public.sms_templates (scope, company_id, template_key, locale, name, body, status)
values
  ('system', null, 'visit_reminder', 'sv', 'Besökspåminnelse', 'Hej! Vi planerar besök hos dig {date} cirka {time}. Svara om tiden inte fungerar.', 'active'),
  ('system', null, 'visit_reminder', 'en', 'Visit reminder', 'Hello! We plan to visit you on {date} around {time}. Reply if the time does not work.', 'active'),
  ('system', null, 'delay_notice', 'sv', 'Förseningsmeddelande', 'Hej! Vi är försenade och beräknar ny tid {eta}. Tack för tålamodet.', 'active'),
  ('system', null, 'delay_notice', 'en', 'Delay notice', 'Hello! We are delayed and estimate a new time at {eta}. Thank you for your patience.', 'active'),
  ('system', null, 'delivery_eta', 'sv', 'Leverans-ETA', 'Din leverans är planerad till {eta}. Svara med portkod eller instruktion om det behövs.', 'active'),
  ('system', null, 'delivery_eta', 'en', 'Delivery ETA', 'Your delivery is planned for {eta}. Reply with gate code or instructions if needed.', 'active')
on conflict do nothing;

-- Pricing rules for the first sellable industry tracks.
insert into public.pricing_rules (scope, company_id, industry_type, rule_key, name, status, currency, config)
values
  ('system', null, 'courier', 'transport_standard', 'Transport standardpris', 'active', 'SEK', '{"per_km":18,"per_stop":95,"waiting_per_minute":9,"express_multiplier":1.35,"evening_multiplier":1.2}'),
  ('system', null, 'cleaning', 'cleaning_standard', 'Städ standardpris', 'active', 'SEK', '{"per_hour":520,"material_fee":120,"window_price":75,"weekend_multiplier":1.35}'),
  ('system', null, 'home_care', 'care_visit_standard', 'Besök standardpris', 'active', 'SEK', '{"per_hour":610,"double_staff_multiplier":2,"cancelled_visit_fee":180,"travel_per_km":12}'),
  ('system', null, 'construction', 'project_standard', 'Projekt standardpris', 'active', 'SEK', '{"labor_hour":650,"risk_markup_percent":12,"margin_percent":30,"project_management_percent":8}'),
  ('system', null, 'property', 'property_service_standard', 'Fastighetsservice standardpris', 'active', 'SEK', '{"technician_hour":690,"vehicle_fee":250,"emergency_multiplier":1.5,"material_markup_percent":18}')
on conflict do nothing;

-- Demo scenarios for sales mode. No tenant data is inserted until a seed run uses these definitions.
insert into public.demo_scenarios (scope, company_id, industry_type, scenario_key, name, description, data, status)
values
  ('system', null, 'courier', 'courier_malmo_day', 'Bud/Kurir Malmö dag', 'Rutter, pickup/dropoff, avvikelse och SMS-flöde för transportdemo.', '{"routes":3,"tasks":24,"deviations":2,"chatChannels":["Transportledning Syd","Chaufförer Skåne"]}', 'active'),
  ('system', null, 'cleaning', 'cleaning_malmo_week', 'Städ Malmö vecka', 'Återkommande städ, objekt, checklistor, resurser och avvikelseflöde.', '{"objects":12,"tasks":36,"resources":["Nycklar","Städmaskiner"],"chatChannels":["Städteam Malmö"]}', 'active'),
  ('system', null, 'home_care', 'home_care_skane_day', 'Hemtjänst Skåne dag', 'Besök, kontinuitet, nycklar, dubbelbemanning och mobil utförandevy.', '{"visits":42,"routes":5,"risk":"continuity","chatChannels":["Kvällspass Skåne","Teamledare"]}', 'active'),
  ('system', null, 'construction', 'renovation_project_demo', 'Renoveringsprojekt demo', 'Projektintake, kalkyl, arbetsmoment, planeringsutkast och efterkalkyl.', '{"projectType":"renovation","workItems":8,"calculation":true,"actuals":true}', 'active'),
  ('system', null, 'municipality', 'municipality_ops_demo', 'Kommunal drift demo', 'Måltidsleverans, intern service, parkdrift och SLA-risk.', '{"departments":4,"tasks":30,"deviations":3,"reports":["SLA","completion"]}', 'active')
on conflict do nothing;

insert into public.industry_preset_rules (scope, company_id, industry_type, rule_key, rule_type, config, status)
values
  ('system', null, 'courier', 'vehicle_capacity_required', 'planning', '{"severity":"hard","message_key":"vehicle_capacity_required"}', 'active'),
  ('system', null, 'courier', 'time_window_delivery', 'planning', '{"severity":"hard","message_key":"time_window_delivery"}', 'active'),
  ('system', null, 'home_care', 'continuity_preferred', 'planning', '{"severity":"warning","message_key":"continuity_preferred"}', 'active'),
  ('system', null, 'home_care', 'double_staff_required', 'planning', '{"severity":"hard","message_key":"double_staff_required"}', 'active'),
  ('system', null, 'cleaning', 'key_required', 'planning', '{"severity":"hard","message_key":"key_required"}', 'active'),
  ('system', null, 'construction', 'dependency_order', 'project', '{"severity":"hard","message_key":"dependency_order"}', 'active'),
  ('system', null, 'property', 'sla_priority', 'deviation', '{"severity":"warning","message_key":"sla_priority"}', 'active')
on conflict do nothing;

-- Add modules to active_modules where localization is present; other engines stay governed by company_modules statuses.
update public.company_settings
set active_modules = array(select distinct unnest(coalesce(active_modules, '{}'::text[]) || array['localization'])),
    updated_at = timezone('utc', now())
where true;

create or replace view public.coordiqo_pilot_readiness_v
with (security_invoker = true)
as
select
  c.id as company_id,
  c.name as company_name,
  coalesce(s.readiness_status, 'missing_saas_readiness') as saas_readiness_status,
  (select count(*) from public.staff_profiles sp where sp.company_id = c.id and sp.archived_at is null) as staff_count,
  (select count(*) from public.tasks t where t.company_id = c.id and t.archived_at is null) as task_count,
  (select count(*) from public.resource_assets r where r.company_id = c.id and r.archived_at is null) as resource_count,
  (select count(*) from public.projects p where p.company_id = c.id and p.archived_at is null) as project_count,
  (select count(*) from public.optimization_runs o where o.company_id = c.id and o.archived_at is null) as optimization_count,
  (select count(*) from public.project_calculation_runs pcr where pcr.company_id = c.id and pcr.archived_at is null) as calculation_count,
  (select count(*) from public.chat_channels cc where cc.company_id = c.id and cc.archived_at is null) as chat_channel_count,
  (select count(*) from public.billing_underlays b where b.company_id = c.id and b.archived_at is null) as billing_underlay_count,
  case
    when coalesce(s.readiness_status, '') <> 'ready' then 'needs_foundation'
    when (select count(*) from public.staff_profiles sp where sp.company_id = c.id and sp.archived_at is null) = 0 then 'needs_staff'
    when (select count(*) from public.tasks t where t.company_id = c.id and t.archived_at is null) = 0 then 'needs_tasks'
    when (select count(*) from public.optimization_runs o where o.company_id = c.id and o.archived_at is null) = 0 then 'needs_optimization'
    when (select count(*) from public.project_calculation_runs pcr where pcr.company_id = c.id and pcr.archived_at is null) = 0 then 'needs_project_calculation'
    when (select count(*) from public.chat_channels cc where cc.company_id = c.id and cc.archived_at is null) = 0 then 'needs_command_center'
    when (select count(*) from public.billing_underlays b where b.company_id = c.id and b.archived_at is null) = 0 then 'needs_billing_underlay'
    else 'pilot_ready'
  end as readiness_status
from public.companies c
left join public.coordiqo_saas_readiness_v s on s.company_id = c.id;

