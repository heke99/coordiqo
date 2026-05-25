-- Coordiqo Batch 1 foundation repair
-- Tenant/audit/readiness hardening before routing, optimization and ChatOps.

alter table public.audit_logs add column if not exists action_source text not null default 'manual'
  check (action_source in ('manual', 'system', 'ai', 'sms', 'email', 'integration', 'support'));
alter table public.audit_logs add column if not exists actor_role text;
alter table public.audit_logs add column if not exists entity_display_name text;
alter table public.audit_logs add column if not exists before_value jsonb;
alter table public.audit_logs add column if not exists after_value jsonb;
alter table public.audit_logs add column if not exists request_id text;

create index if not exists idx_audit_logs_company_action_created
  on public.audit_logs(company_id, action, created_at desc);
create index if not exists idx_audit_logs_company_entity_created
  on public.audit_logs(company_id, entity_type, entity_id, created_at desc);
create index if not exists idx_audit_logs_source_created
  on public.audit_logs(action_source, created_at desc);

-- Keep metadata backwards compatible while making new columns usable for future UI/filtering.
create or replace function public.audit_logs_enrich_from_metadata()
returns trigger
language plpgsql
as $$
begin
  if new.metadata ? 'source' and coalesce(new.action_source, 'manual') = 'manual' then
    new.action_source = coalesce(nullif(new.metadata->>'source', ''), 'manual');
  end if;

  if new.actor_role is null and new.metadata ? 'actorRole' then
    new.actor_role = nullif(new.metadata->>'actorRole', '');
  end if;

  if new.entity_display_name is null and new.metadata ? 'entityDisplayName' then
    new.entity_display_name = nullif(new.metadata->>'entityDisplayName', '');
  end if;

  if new.before_value is null and new.metadata ? 'before' then
    new.before_value = new.metadata->'before';
  end if;

  if new.after_value is null and new.metadata ? 'after' then
    new.after_value = new.metadata->'after';
  end if;

  if new.request_id is null and new.metadata ? 'requestId' then
    new.request_id = nullif(new.metadata->>'requestId', '');
  end if;

  return new;
end;
$$;

drop trigger if exists audit_logs_enrich_from_metadata_tg on public.audit_logs;
create trigger audit_logs_enrich_from_metadata_tg
before insert or update on public.audit_logs
for each row execute function public.audit_logs_enrich_from_metadata();

-- Guardrails for tenant membership state. This keeps disabled members from remaining default.
create or replace function public.company_memberships_default_guard()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'active' or new.archived_at is not null then
    new.is_default = false;
  end if;
  return new;
end;
$$;

drop trigger if exists company_memberships_default_guard_tg on public.company_memberships;
create trigger company_memberships_default_guard_tg
before insert or update on public.company_memberships
for each row execute function public.company_memberships_default_guard();

create unique index if not exists idx_company_memberships_one_default_per_user
  on public.company_memberships(user_id)
  where is_default = true and status = 'active' and archived_at is null;

-- Readiness view used by superadmin/support to find tenant isolation problems early.
create or replace view public.coordiqo_foundation_readiness_v as
select
  c.id as company_id,
  c.name as company_name,
  c.status,
  coalesce(c.lifecycle_status, 'active') as lifecycle_status,
  c.industry_type,
  c.operational_model,
  (select count(*) from public.company_memberships m where m.company_id = c.id and m.status = 'active' and m.archived_at is null) as active_memberships,
  (select count(*) from public.teams t where t.company_id = c.id and t.archived_at is null) as teams,
  (select count(*) from public.staff_profiles s where s.company_id = c.id and s.archived_at is null) as staff_profiles,
  (select count(*) from public.tasks t where t.company_id = c.id and t.archived_at is null) as tasks,
  (select count(*) from public.resource_assets r where r.company_id = c.id and r.archived_at is null) as resource_assets,
  (select count(*) from public.audit_logs a where a.company_id = c.id) as audit_events,
  case
    when c.status <> 'active' then 'company_status_not_active'
    when coalesce(c.lifecycle_status, 'active') <> 'active' then 'company_lifecycle_not_active'
    when (select count(*) from public.company_memberships m where m.company_id = c.id and m.status = 'active' and m.archived_at is null) = 0 then 'no_active_memberships'
    when c.industry_type is null or c.operational_model is null then 'missing_industry_or_model'
    else 'ready'
  end as readiness_status
from public.companies c;
