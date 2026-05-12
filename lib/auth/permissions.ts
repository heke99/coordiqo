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

export type PermissionAction =
  | 'company.manage'
  | 'team.manage'
  | 'staff.manage'
  | 'resource.manage'
  | 'entity.manage'
  | 'entity_type.manage'
  | 'invite.manage'
  | 'permission.manage'
  | 'planning.manage'
  | 'task.manage'
  | 'work_order.manage'
  | 'document.manage'
  | 'support.manage'
  | 'audit.view'

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

export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  company_admin: 'Företagsadmin',
  operations_manager: 'Driftansvarig',
  planner: 'Planerare',
  supervisor: 'Supervisor',
  dispatcher: 'Dispatcher',
  team_lead: 'Teamledare',
  staff: 'Personal',
  contractor: 'Extern utförare',
  read_only: 'Endast läsning',
}

export const PERMISSION_MATRIX: Record<PermissionAction, { label: string; minimumRole: CompanyRole; description: string }> = {
  'company.manage': {
    label: 'Hantera företag',
    minimumRole: 'operations_manager',
    description: 'Företagsinställningar, operativ profil och övergripande konfiguration.',
  },
  'team.manage': {
    label: 'Hantera team',
    minimumRole: 'supervisor',
    description: 'Skapa, uppdatera och arkivera team och teamstruktur.',
  },
  'staff.manage': {
    label: 'Hantera personal',
    minimumRole: 'supervisor',
    description: 'Skapa och underhålla personalprofiler, språk, körkort och status.',
  },
  'resource.manage': {
    label: 'Hantera resurser',
    minimumRole: 'supervisor',
    description: 'Fordon, utrustning, nycklar, taggar och resurskopplingar.',
  },
  'entity.manage': {
    label: 'Hantera objekt',
    minimumRole: 'planner',
    description: 'Skapa och underhålla kunder, platser, objekt och relationer.',
  },
  'entity_type.manage': {
    label: 'Hantera objekttyper',
    minimumRole: 'operations_manager',
    description: 'Konfigurera branschstyrda objekttyper och dynamiska fält.',
  },
  'invite.manage': {
    label: 'Hantera inbjudningar',
    minimumRole: 'operations_manager',
    description: 'Skapa, avbryt och följa upp användarinbjudningar.',
  },
  'permission.manage': {
    label: 'Se behörigheter',
    minimumRole: 'operations_manager',
    description: 'Se rollmatris och åtkomstnivåer per företagsroll.',
  },
  'planning.manage': {
    label: 'Planera drift',
    minimumRole: 'planner',
    description: 'Kommande uppdrag, planering, tilldelning och dispatch.',
  },
  'task.manage': {
    label: 'Hantera uppdrag',
    minimumRole: 'planner',
    description: 'Skapa, uppdatera, arkivera och kommentera uppdrag.',
  },
  'work_order.manage': {
    label: 'Hantera arbetsorder',
    minimumRole: 'planner',
    description: 'Skapa och styra arbetsorder och koppling till ärenden.',
  },
  'document.manage': {
    label: 'Hantera dokument',
    minimumRole: 'planner',
    description: 'Ladda upp och arkivera dokument på objekt och uppdrag.',
  },
  'support.manage': {
    label: 'Supportläge',
    minimumRole: 'company_admin',
    description: 'Hantera supportspår, åtkomstloggning och supportsessioner.',
  },
  'audit.view': {
    label: 'Se audit',
    minimumRole: 'operations_manager',
    description: 'Se känsliga historik- och ändringshändelser.',
  },
}

export function hasMinimumCompanyRole(role: CompanyRole | null | undefined, minimum: CompanyRole) {
  if (!role) return false
  return COMPANY_ROLE_RANK[role] >= COMPANY_ROLE_RANK[minimum]
}

export function can(role: CompanyRole | null | undefined, action: PermissionAction) {
  return hasMinimumCompanyRole(role, PERMISSION_MATRIX[action].minimumRole)
}

export function canManageCompany(role: CompanyRole | null | undefined) {
  return can(role, 'company.manage')
}

export function canManageTeams(role: CompanyRole | null | undefined) {
  return can(role, 'team.manage')
}

export function canManageStaff(role: CompanyRole | null | undefined) {
  return can(role, 'staff.manage')
}

export function canManageResources(role: CompanyRole | null | undefined) {
  return can(role, 'resource.manage')
}

export function canManageEntities(role: CompanyRole | null | undefined) {
  return can(role, 'entity.manage')
}

export function canManageEntityTypes(role: CompanyRole | null | undefined) {
  return can(role, 'entity_type.manage')
}

export function canManageInvitations(role: CompanyRole | null | undefined) {
  return can(role, 'invite.manage')
}

export function canManageTasks(role: CompanyRole | null | undefined) {
  return can(role, 'task.manage')
}

export function canManageWorkOrders(role: CompanyRole | null | undefined) {
  return can(role, 'work_order.manage')
}

export function canManageDocuments(role: CompanyRole | null | undefined) {
  return can(role, 'document.manage')
}

export function canManageSupport(role: CompanyRole | null | undefined) {
  return can(role, 'support.manage')
}

export function canManagePermissions(role: CompanyRole | null | undefined) {
  return can(role, 'permission.manage')
}

export function canPlan(role: CompanyRole | null | undefined) {
  return can(role, 'planning.manage')
}

export function assertCompanyPermission(role: CompanyRole | null | undefined, minimum: CompanyRole, label = 'åtgärden') {
  if (!hasMinimumCompanyRole(role, minimum)) {
    throw new Error(`Du saknar behörighet för ${label}.`)
  }
}

export function assertPermission(role: CompanyRole | null | undefined, action: PermissionAction) {
  if (!can(role, action)) {
    throw new Error(`Du saknar behörighet för ${PERMISSION_MATRIX[action].label.toLowerCase()}.`)
  }
}
