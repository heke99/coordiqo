import { getIndustryRegistry } from '@/lib/industry/registry'
import { getRoutingProviderEnvironment } from '@/lib/routing/providers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type ReadinessLevel = 'ok' | 'warning' | 'critical'

export type ReadinessCheck = {
  key: string
  label: string
  level: ReadinessLevel
  detail: string
  fixHint?: string
  repairable?: boolean
}

export type CompanyReadiness = {
  companyId: string
  checks: ReadinessCheck[]
  criticalCount: number
  warningCount: number
  isReady: boolean
}

function check(
  key: string,
  label: string,
  ok: boolean,
  detail: { ok: string; fail: string },
  options: { failLevel?: ReadinessLevel; fixHint?: string; repairable?: boolean } = {},
): ReadinessCheck {
  return {
    key,
    label,
    level: ok ? 'ok' : options.failLevel ?? 'critical',
    detail: ok ? detail.ok : detail.fail,
    fixHint: ok ? undefined : options.fixHint,
    repairable: ok ? false : options.repairable ?? false,
  }
}

/**
 * Full readiness evaluation for one company, per the go-live definition:
 * active company, settings, industry profile, operational model, runtime
 * config, onboarding session, at least one admin/team, entity/task/resource
 * types, permissions, routing provider or fallback.
 */
export async function getCompanyReadiness(companyId: string): Promise<CompanyReadiness> {
  const [companyRes, settingsRes, runtimeRes, onboardingRes, adminsRes, teamsRes, entityTypesRes, taskTypesRes, resourceTypesRes, permissionsRes, registry] = await Promise.all([
    supabaseAdmin.from('companies').select('id, name, status, lifecycle_status, industry_type, operational_model').eq('id', companyId).maybeSingle(),
    supabaseAdmin.from('company_settings').select('company_id, active_modules').eq('company_id', companyId).maybeSingle(),
    supabaseAdmin.from('industry_runtime_configs').select('id, industry_code, operational_model').eq('company_id', companyId).maybeSingle(),
    supabaseAdmin.from('company_onboarding_sessions').select('id, status').eq('company_id', companyId).maybeSingle(),
    supabaseAdmin.from('company_memberships').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('role', 'company_admin').eq('status', 'active').is('archived_at', null),
    supabaseAdmin.from('teams').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('archived_at', null),
    supabaseAdmin.from('entity_types').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true).is('archived_at', null),
    supabaseAdmin.from('task_types').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true).is('archived_at', null),
    supabaseAdmin.from('resource_types').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true).is('archived_at', null),
    supabaseAdmin.from('company_role_permissions').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    getIndustryRegistry(),
  ])

  const company = companyRes.data
  const routing = getRoutingProviderEnvironment()
  const industryCode = company?.industry_type ?? null
  const industryInRegistry = industryCode ? registry.some((profile) => profile.code === industryCode) : false

  const checks: ReadinessCheck[] = [
    check('company_active', 'Bolaget är aktivt', Boolean(company && company.status === 'active' && (company.lifecycle_status ?? 'active') === 'active'), {
      ok: 'Status aktiv.',
      fail: `Status: ${company?.status ?? 'saknas'} / ${company?.lifecycle_status ?? 'saknas'}.`,
    }, { fixHint: 'Aktivera bolaget under bolagsstyrning.' }),
    check('company_settings', 'Företagsinställningar finns', Boolean(settingsRes.data), {
      ok: 'Inställningar finns.',
      fail: 'company-inställningar saknas.',
    }, { fixHint: 'Kör reparation av standardinställningar.', repairable: true }),
    check('industry_profile', 'Branschprofil finns i registret', industryInRegistry, {
      ok: `Bransch: ${industryCode}.`,
      fail: industryCode ? `Branschen "${industryCode}" finns inte i branschregistret.` : 'Bransch är inte vald.',
    }, { fixHint: 'Välj en bransch från registret eller lägg till branschen under Branscher.', failLevel: 'warning' }),
    check('operational_model', 'Arbetssätt är valt', Boolean(company?.operational_model && company.operational_model !== 'task_based'), {
      ok: `Arbetssätt: ${company?.operational_model}.`,
      fail: 'Primärt arbetssätt är inte valt.',
    }, { fixHint: 'Välj arbetssätt under bransch-inställningarna.', failLevel: 'warning', repairable: true }),
    check('runtime_config', 'Branschkonfiguration finns', Boolean(runtimeRes.data), {
      ok: 'Konfiguration finns.',
      fail: 'Branschkonfiguration saknas.',
    }, { fixHint: 'Kör reparation av standardinställningar.', repairable: true }),
    check('onboarding_session', 'Onboarding är startad', Boolean(onboardingRes.data), {
      ok: `Onboarding: ${onboardingRes.data?.status ?? 'okänd'}.`,
      fail: 'Onboarding-session saknas.',
    }, { fixHint: 'Kör reparation av standardinställningar.', failLevel: 'warning', repairable: true }),
    check('company_admin', 'Minst en företagsadministratör', Number(adminsRes.count ?? 0) > 0, {
      ok: `${adminsRes.count} administratör(er).`,
      fail: 'Ingen aktiv företagsadministratör finns.',
    }, { fixHint: 'Skapa eller bjud in första administratören.' }),
    check('team', 'Minst ett team', Number(teamsRes.count ?? 0) > 0, {
      ok: `${teamsRes.count} team.`,
      fail: 'Inget team är skapat.',
    }, { fixHint: 'Skapa första teamet.', failLevel: 'warning' }),
    check('entity_types', 'Objekttyper finns', Number(entityTypesRes.count ?? 0) > 0, {
      ok: `${entityTypesRes.count} objekttyper.`,
      fail: 'Inga objekttyper finns.',
    }, { fixHint: 'Kör reparation av standardinställningar.', repairable: true }),
    check('task_types', 'Uppdragstyper finns', Number(taskTypesRes.count ?? 0) > 0, {
      ok: `${taskTypesRes.count} uppdragstyper.`,
      fail: 'Inga uppdragstyper finns.',
    }, { fixHint: 'Kör reparation av standardinställningar.', repairable: true }),
    check('resource_types', 'Resurstyper finns', Number(resourceTypesRes.count ?? 0) > 0, {
      ok: `${resourceTypesRes.count} resurstyper.`,
      fail: 'Inga resurstyper finns.',
    }, { fixHint: 'Kör reparation av standardinställningar.', failLevel: 'warning', repairable: true }),
    check('permissions', 'Behörighetsmatris finns', Number(permissionsRes.count ?? 0) > 0, {
      ok: `${permissionsRes.count} behörighetsposter.`,
      fail: 'Behörighetsposter saknas (standardroller gäller ändå).',
    }, { failLevel: 'warning' }),
    check('routing', 'Ruttberäkning', true, {
      ok: routing.configured ? `${routing.label} är konfigurerad.` : 'Ingen ruttleverantör — intern uppskattning används (fungerar).',
      fail: '',
    }),
  ]

  const criticalCount = checks.filter((item) => item.level === 'critical').length
  const warningCount = checks.filter((item) => item.level === 'warning').length

  return {
    companyId,
    checks,
    criticalCount,
    warningCount,
    isReady: criticalCount === 0,
  }
}
