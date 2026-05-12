alter table public.companies
  add column if not exists slug text;

create unique index if not exists idx_companies_slug_unique
  on public.companies (slug)
  where slug is not null;

create or replace function public.slugify_text(input text)
returns text
language plpgsql
immutable
as $$
declare
  value text;
begin
  value := lower(trim(coalesce(input, '')));
  value := regexp_replace(value, '[^a-z0-9]+', '-', 'g');
  value := regexp_replace(value, '(^-+|-+$)', '', 'g');
  value := regexp_replace(value, '-{2,}', '-', 'g');

  if value = '' then
    return 'company';
  end if;

  return value;
end;
$$;

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
    array['foundation'],
    coalesce(nullif(trim(coalesce(p_industry_type, '')), ''), 'other'),
    'google_maps',
    false
  )
  on conflict (company_id) do nothing;

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
      'source', 'self_serve_onboarding'
    )
  );

  return v_company_id;
end;
$$;

grant execute on function public.bootstrap_company_for_current_user(text, text, text, text, text, text) to authenticated;
