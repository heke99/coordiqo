-- Coordiqo go-live: security hardening.
--
-- 1. planning_ai_requests was created without RLS — enable it with strict
--    company-scoped policies.
-- 2. api_keys metadata (key prefix/hash) was readable by every company member;
--    restrict reads to planner and above.
--
-- Additive and idempotent. No data is modified or removed.

-- 1. planning_ai_requests ------------------------------------------------------

alter table public.planning_ai_requests enable row level security;

drop policy if exists planning_ai_requests_select on public.planning_ai_requests;
create policy planning_ai_requests_select on public.planning_ai_requests
for select using (public.is_platform_admin() or public.is_company_member(company_id));

drop policy if exists planning_ai_requests_write on public.planning_ai_requests;
create policy planning_ai_requests_write on public.planning_ai_requests
for all
using (public.is_platform_admin() or public.has_company_role(company_id, 'planner'))
with check (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

-- 2. api_keys ------------------------------------------------------------------

drop policy if exists api_keys_select on public.api_keys;
create policy api_keys_select on public.api_keys
for select using (public.is_platform_admin() or public.has_company_role(company_id, 'planner'));

-- The existing write policy already requires planner+; keep it as-is.
