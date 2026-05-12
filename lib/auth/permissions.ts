export type PlatformRole = 'owner' | 'platform_admin' | 'support_admin' | 'billing_admin' | 'compliance_admin' | null

export type CompanyRole =
  | 'company_admin'
  | 'operations_manager'
  | 'planner'
  | 'supervisor'
  | 'dispatcher'
  | 'team_lead'
  | 'staff'
  | 'contractor'
  | 'read_only'

export const COMPANY_ROLE_RANK: Record<CompanyRole, number> = {
  company_admin: 100,
  operations_manager: 90,
  planner: 80,
  supervisor: 70,
  dispatcher: 60,
  team_lead: 50,
  staff: 40,
  contractor: 30,
  read_only: 10,
}

export function hasMinimumCompanyRole(role: CompanyRole | null | undefined, minimum: CompanyRole) {
  if (!role) return false
  return COMPANY_ROLE_RANK[role] >= COMPANY_ROLE_RANK[minimum]
}

export function canManageCompany(role: CompanyRole | null | undefined) {
  return hasMinimumCompanyRole(role, 'operations_manager')
}

export function canManageTeams(role: CompanyRole | null | undefined) {
  return hasMinimumCompanyRole(role, 'supervisor')
}

export function canManageStaff(role: CompanyRole | null | undefined) {
  return hasMinimumCompanyRole(role, 'supervisor')
}

export function canManageResources(role: CompanyRole | null | undefined) {
  return hasMinimumCompanyRole(role, 'supervisor')
}

export function canManageEntities(role: CompanyRole | null | undefined) {
  return hasMinimumCompanyRole(role, 'planner')
}

export function canPlan(role: CompanyRole | null | undefined) {
  return hasMinimumCompanyRole(role, 'planner')
}

export function assertCompanyPermission(role: CompanyRole | null | undefined, minimum: CompanyRole, label = 'åtgärden') {
  if (!hasMinimumCompanyRole(role, minimum)) {
    throw new Error(`Du saknar behörighet för ${label}.`)
  }
}
