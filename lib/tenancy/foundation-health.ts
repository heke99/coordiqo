import { supabaseAdmin } from '@/lib/supabase/admin'

export type FoundationHealthCheck = {
  key: string
  label: string
  ok: boolean
  severity: 'info' | 'warning' | 'critical'
  detail: string
  href: string
}

async function countRows(table: string, companyId: string) {
  const { count } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('company_id', companyId)
  return count ?? 0
}

export async function getFoundationHealthChecks(companyId: string) {
  const [
    members,
    activeMembers,
    teams,
    staff,
    taskTypes,
    resourceTypes,
    resourceAssets,
    shifts,
    tasks,
    planningRuns,
    auditEvents,
    notifications,
    permissionOverrides,
    companyRes,
  ] = await Promise.all([
    countRows('company_memberships', companyId),
    supabaseAdmin.from('company_memberships').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'active').is('archived_at', null),
    countRows('teams', companyId),
    countRows('staff_profiles', companyId),
    countRows('task_types', companyId),
    countRows('resource_types', companyId),
    countRows('resource_assets', companyId),
    countRows('shifts', companyId),
    countRows('tasks', companyId),
    countRows('planning_runs', companyId),
    countRows('audit_logs', companyId),
    countRows('notifications', companyId),
    countRows('company_role_permissions', companyId),
    supabaseAdmin.from('companies').select('id, status, lifecycle_status, industry_type, operational_model').eq('id', companyId).maybeSingle(),
  ])

  const company = companyRes.data as { status?: string | null; lifecycle_status?: string | null; industry_type?: string | null; operational_model?: string | null } | null
  const checks: FoundationHealthCheck[] = [
    {
      key: 'company_active',
      label: 'Tenant är aktiv',
      ok: company?.status === 'active' && (company?.lifecycle_status ?? 'active') === 'active',
      severity: 'critical',
      href: '/settings/health',
      detail: `${company?.status ?? 'okänd status'} · ${company?.lifecycle_status ?? 'active'}`,
    },
    {
      key: 'industry_model',
      label: 'Bransch och operativ modell finns',
      ok: Boolean(company?.industry_type && company?.operational_model),
      severity: 'critical',
      href: '/settings/industry',
      detail: `${company?.industry_type ?? 'bransch saknas'} · ${company?.operational_model ?? 'modell saknas'}`,
    },
    {
      key: 'active_memberships',
      label: 'Aktiva användare finns',
      ok: (activeMembers.count ?? 0) > 0,
      severity: 'critical',
      href: '/settings/permissions',
      detail: `${activeMembers.count ?? 0} aktiva av ${members} medlemskap`,
    },
    {
      key: 'teams_staff',
      label: 'Team och personal finns',
      ok: teams > 0 && staff > 0,
      severity: 'warning',
      href: '/staff',
      detail: `${teams} team · ${staff} personalprofiler`,
    },
    {
      key: 'task_foundation',
      label: 'Uppdragstyper och uppdrag finns',
      ok: taskTypes > 0,
      severity: 'warning',
      href: '/tasks',
      detail: `${taskTypes} uppdragstyper · ${tasks} uppdrag`,
    },
    {
      key: 'resource_foundation',
      label: 'Resursmodell finns',
      ok: resourceTypes > 0,
      severity: 'warning',
      href: '/resources',
      detail: `${resourceTypes} resurstyper · ${resourceAssets} resurser`,
    },
    {
      key: 'schedule_foundation',
      label: 'Schema/pass finns',
      ok: shifts > 0,
      severity: 'warning',
      href: '/schedule',
      detail: `${shifts} pass`,
    },
    {
      key: 'planning_foundation',
      label: 'Planeringskörningar spåras',
      ok: planningRuns >= 0,
      severity: 'info',
      href: '/planning/runs',
      detail: `${planningRuns} planeringskörningar`,
    },
    {
      key: 'audit_foundation',
      label: 'Auditlogg aktiv',
      ok: auditEvents > 0,
      severity: 'critical',
      href: '/audit',
      detail: `${auditEvents} audit-händelser`,
    },
    {
      key: 'notifications_foundation',
      label: 'Notiscenter kan användas',
      ok: notifications >= 0,
      severity: 'info',
      href: '/notifications',
      detail: `${notifications} notiser`,
    },
    {
      key: 'permission_overrides',
      label: 'Rollstyrning går att granska',
      ok: permissionOverrides >= 0,
      severity: 'info',
      href: '/settings/permissions',
      detail: `${permissionOverrides} permission overrides`,
    },
  ]

  return checks
}
